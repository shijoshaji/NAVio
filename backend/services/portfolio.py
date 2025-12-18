from sqlalchemy.orm import Session
from models import Investment, Portfolio, Scheme, Watchlist, WatchlistGroup
from datetime import date
from sqlalchemy import func

def add_investment(db: Session, scheme_code: str, invest_type: str, amount: float, purchase_nav: float, purchase_date: date):
    """
    Adds a new investment (SIP or Lumpsum) and updates the portfolio.
    """
    units = amount / purchase_nav
    
    # 1. Record Transaction
    new_investment = Investment(
        scheme_code=scheme_code,
        type=invest_type,
        amount=amount,
        units=units,
        purchase_nav=purchase_nav,
        purchase_date=purchase_date
    )
    db.add(new_investment)
    
    # 2. Update Portfolio (Aggregated Holdings)
    portfolio_item = db.query(Portfolio).filter(Portfolio.scheme_code == scheme_code).first()
    
    if portfolio_item:
        # Weighted Average NAV Calculation
        total_units = portfolio_item.total_units + units
        total_invested = portfolio_item.invested_amount + amount
        portfolio_item.average_nav = total_invested / total_units
        portfolio_item.total_units = total_units
        portfolio_item.invested_amount = total_invested
    else:
        new_portfolio_item = Portfolio(
            scheme_code=scheme_code,
            total_units=units,
            average_nav=purchase_nav,
            invested_amount=amount
        )
        db.add(new_portfolio_item)
    
    db.commit()
    db.refresh(new_investment)
    return new_investment

def get_portfolio_summary(db: Session):
    """
    Returns the portfolio with current valuation.
    """
    portfolio_items = db.query(Portfolio).all()
    summary = []
    
    total_invested = 0
    total_current_value = 0
    
    for item in portfolio_items:
        # Skip items with negligible units (effectively sold out)
        if item.total_units <= 0.0001:
            continue

        current_nav = item.scheme.net_asset_value
        current_value = item.total_units * current_nav
        
        # Calculate XIRR/Returns could go here in future
        abs_return = current_value - item.invested_amount
        return_pct = (abs_return / item.invested_amount) * 100 if item.invested_amount > 0 else 0
        
        summary.append({
            "scheme_code": item.scheme_code,
            "scheme_name": item.scheme.scheme_name,
            "invested_amount": item.invested_amount,
            "current_value": current_value,
            "total_units": item.total_units,
            "average_nav": item.average_nav,
            "current_nav": current_nav,
            "absolute_return": abs_return,
            "return_percentage": return_pct
        })
        
        total_invested += item.invested_amount
        total_current_value += current_value
        
    return {
        "holdings": summary,
        "total_invested": total_invested,
        "total_current_value": total_current_value,
        "total_gain": total_current_value - total_invested
    }

def add_to_watchlist(db: Session, scheme_code: str, group_id: int = None, target_nav: float = None, units: float = 0.0, invested_amount: float = 0.0):
    """Adds a scheme to the watchlist with optional group and details."""
    # Check if already in watchlist WITH THE SAME GROUP (allow same fund in different groups)
    existing = db.query(Watchlist).filter(
        Watchlist.scheme_code == scheme_code,
        Watchlist.group_id == group_id
    ).first()
    
    if existing:
        # Update existing entry (same fund, same group)
        if target_nav is not None:
            existing.target_nav = target_nav
        if units > 0:
            existing.units = units
        if invested_amount > 0:
            existing.invested_amount = invested_amount
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new entry
    item = Watchlist(
        scheme_code=scheme_code,
        group_id=group_id,
        target_nav=target_nav,
        units=units,
        invested_amount=invested_amount
    )
    db.add(item)
    db.commit()
    return item

def get_watchlist(db: Session):
    """Gets watchlist with details and latest NAVs."""
    from models import NAVHistory
    from datetime import timedelta, date
    from sqlalchemy import func

    items = db.query(Watchlist).all()
    result = []
    
    today = date.today()
    one_year_ago = today - timedelta(days=365)
    
    for item in items:
        group_name = item.group.name if item.group else "Uncategorized"
        current_nav = item.scheme.net_asset_value
        
        # Calculate current value if units present
        # Calculate current value if units present
        if item.is_sold and item.sold_nav:
            # For Sold items, current value is Realised Value
            current_nav = item.sold_nav # Context override for display
            current_value = (item.units * item.sold_nav) if item.units else 0
        else:
            current_value = (item.units * current_nav) if item.units else 0
            
        gain_loss = (current_value - item.invested_amount) if item.invested_amount else 0
        gain_loss_pct = (gain_loss / item.invested_amount * 100) if item.invested_amount > 0 else 0

        # Calculate 52-Week High/Low (Last 365 Days) WITH DATES
        query_52w = db.query(NAVHistory).filter(
            NAVHistory.scheme_code == item.scheme_code,
            NAVHistory.date >= one_year_ago
        )
        
        high_52_row = query_52w.order_by(NAVHistory.net_asset_value.desc()).first()
        low_52_row = query_52w.order_by(NAVHistory.net_asset_value.asc()).first()

        high_52 = high_52_row.net_asset_value if high_52_row else current_nav
        low_52 = low_52_row.net_asset_value if low_52_row else current_nav
        
        high_52_date = high_52_row.date if high_52_row else None
        low_52_date = low_52_row.date if low_52_row else None

        # Calculate "Since Tracking" High/Low (History >= Added On) WITH DATES
        # We need actual rows to get dates.
        query_base = db.query(NAVHistory).filter(NAVHistory.scheme_code == item.scheme_code)
        
        if item.added_on:
            query_base = query_base.filter(NAVHistory.date >= item.added_on)
            
        high_row = query_base.order_by(NAVHistory.net_asset_value.desc()).first()
        low_row = query_base.order_by(NAVHistory.net_asset_value.asc()).first()

        high_all = high_row.net_asset_value if high_row else current_nav
        low_all = low_row.net_asset_value if low_row else current_nav
        
        high_date = high_row.date if high_row else None
        low_date = low_row.date if low_row else None
        
        # Fallback Logic
        if current_nav > high_52: 
            high_52 = current_nav
            high_52_date = item.scheme.date
            
        if current_nav < low_52 and low_52 > 0: 
            low_52 = current_nav
            low_52_date = item.scheme.date
        elif low_52 == 0: 
            low_52 = current_nav 
            low_52_date = item.scheme.date

        if current_nav > high_all: 
            high_all = current_nav
            high_date = item.scheme.date # Today/Current Date
            
        if current_nav < low_all and low_all > 0: 
            low_all = current_nav
            low_date = item.scheme.date
        elif low_all == 0: 
            low_all = current_nav
            low_date = item.scheme.date

        result.append({
            "id": item.id,
            "scheme_code": item.scheme_code,
            "scheme_name": item.scheme.scheme_name,
            "nav": current_nav,
            "date": item.scheme.date,
            "group_id": item.group_id,
            "group_name": group_name,
            "target_nav": item.target_nav,
            "units": item.units,
            "invested_amount": item.invested_amount,
            "current_value": current_value,
            "gain_loss": gain_loss,
            "gain_loss_pct": gain_loss_pct,
            # Stats
            "high_52w": high_52,
            "low_52w": low_52,
            "high_52w_date": high_52_date,
            "low_52w_date": low_52_date,
            "high_since_tracking": high_all,
            "low_since_tracking": low_all,
            "high_since_tracking_date": high_date,
            "low_since_tracking_date": low_date,
            "added_on": item.added_on,
            # Sold Info
            "is_sold": item.is_sold,
            "sold_nav": item.sold_nav,
            "sold_date": item.sold_date
        })
    return result

def delete_watchlist_item(db: Session, item_id: int):
    """Hard delete a watchlist item."""
    item = db.query(Watchlist).filter(Watchlist.id == item_id).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True

def update_watchlist_item_date(db: Session, item_id: int, new_date: date):
    """Updates the 'added_on' date for a watchlist item."""
    item = db.query(Watchlist).filter(Watchlist.id == item_id).first()
    if not item:
        return None
    
    item.added_on = new_date
    db.commit()
    db.refresh(item)
    return item

def mark_watchlist_item_sold(db: Session, item_id: int, sold_nav: float, sold_date: date):
    """Mark an item as sold."""
    item = db.query(Watchlist).filter(Watchlist.id == item_id).first()
    if not item:
        return None
    
    item.is_sold = True
    item.sold_nav = sold_nav
    item.sold_date = sold_date
    
    db.commit()
    db.refresh(item)
    return item

def create_watchlist_group(db: Session, name: str):
    """Creates a new watchlist group."""
    existing = db.query(WatchlistGroup).filter(WatchlistGroup.name == name).first()
    if existing:
        return existing
    
    group = WatchlistGroup(name=name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

def get_watchlist_groups(db: Session):
    """Get all groups."""
    return db.query(WatchlistGroup).all()

def update_watchlist_group(db: Session, group_id: int, name: str):
    """Update group name."""
    group = db.query(WatchlistGroup).filter(WatchlistGroup.id == group_id).first()
    if not group:
        return None
    group.name = name
    db.commit()
    db.refresh(group)
    return group

def delete_watchlist_group(db: Session, group_id: int):
    """Delete group and all its watchlist items."""
    group = db.query(WatchlistGroup).filter(WatchlistGroup.id == group_id).first()
    if not group:
        return False
    
    # Cascade delete watchlist items
    db.query(Watchlist).filter(Watchlist.group_id == group_id).delete()
    
    # Delete group
    db.delete(group)
    db.commit()
    return True

def delete_investment(db: Session, investment_id: int):
    """
    Deletes an investment and reverses its impact on the portfolio.
    """
    investment = db.query(Investment).filter(Investment.id == investment_id).first()
    if not investment:
        return False
    
    # Update Portfolio - Reverse impact
    portfolio_item = db.query(Portfolio).filter(Portfolio.scheme_code == investment.scheme_code).first()
    
    if portfolio_item:
        portfolio_item.total_units -= investment.units
        portfolio_item.invested_amount -= investment.amount
        
        # Handle floating point precision / zeroing out
        if portfolio_item.total_units <= 0.0001:  # Threshold for practical zero
            portfolio_item.total_units = 0.0
            portfolio_item.invested_amount = 0.0
            portfolio_item.average_nav = 0.0
        else:
            # Recalculate Average NAV based on remaining amount and units
            portfolio_item.average_nav = portfolio_item.invested_amount / portfolio_item.total_units
            
    db.delete(investment)
    db.commit()
    return True

def update_investment(db: Session, investment_id: int, scheme_code: str, invest_type: str, amount: float, purchase_nav: float, purchase_date: date):
    """
    Updates an investment by reversing old one and adding new one.
    """
    # 1. Get old investment
    investment = db.query(Investment).filter(Investment.id == investment_id).first()
    if not investment:
        return None
        
    # 2. Revert Old Portfolio Impact
    # Note: Using investment.scheme_code from DB, in case user is changing scheme_code (unlikely but possible)
    old_portfolio_item = db.query(Portfolio).filter(Portfolio.scheme_code == investment.scheme_code).first()
    if old_portfolio_item:
        old_portfolio_item.total_units -= investment.units
        old_portfolio_item.invested_amount -= investment.amount
        
        if old_portfolio_item.total_units <= 0.0001:
            old_portfolio_item.total_units = 0.0
            old_portfolio_item.invested_amount = 0.0
            old_portfolio_item.average_nav = 0.0
        else:
            old_portfolio_item.average_nav = old_portfolio_item.invested_amount / old_portfolio_item.total_units

    # 3. Update Investment Record
    investment.scheme_code = scheme_code
    investment.type = invest_type
    investment.amount = amount
    investment.purchase_nav = purchase_nav
    investment.purchase_date = purchase_date
    
    new_units = amount / purchase_nav
    investment.units = new_units
    
    # 4. Apply New Portfolio Impact
    new_portfolio_item = db.query(Portfolio).filter(Portfolio.scheme_code == scheme_code).first()
    if new_portfolio_item:
        new_total_units = new_portfolio_item.total_units + new_units
        new_total_invested = new_portfolio_item.invested_amount + amount
        
        new_portfolio_item.total_units = new_total_units
        new_portfolio_item.invested_amount = new_total_invested
        # Weighted Average NAV
        new_portfolio_item.average_nav = new_total_invested / new_total_units
    else:
        # Create new if didn't exist (e.g. if user changed scheme to a new one)
        new_portfolio_item = Portfolio(
            scheme_code=scheme_code,
            total_units=new_units,
            average_nav=purchase_nav,
            invested_amount=amount
        )
        db.add(new_portfolio_item)
        
    db.commit()
    db.refresh(investment)
    return investment
