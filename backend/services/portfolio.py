from sqlalchemy.orm import Session
from models import Investment, Portfolio, Scheme, Watchlist, WatchlistGroup, NAVHistory
from datetime import date, timedelta
from sqlalchemy import func

def add_investment(db: Session, scheme_code: str, invest_type: str, amount: float, purchase_nav: float, purchase_date: date, holding_period: float = None):
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
        purchase_date=purchase_date,
        holding_period=holding_period
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

def calculate_xirr(transactions):
    """
    Calculates XIRR using Newton-Raphson method.
    transactions: list of (date, amount) tuples.
                  amount < 0 for investments, amount > 0 for redemptions/current value.
    """
    if not transactions:
        return 0.0
        
    # Sort by date
    transactions.sort(key=lambda x: x[0])
    
    # Check bounds (must have at least one positive and one negative)
    amounts = [t[1] for t in transactions]
    if all(a >= 0 for a in amounts) or all(a <= 0 for a in amounts):
        return 0.0

    start_date = transactions[0][0]

    def xnpv(rate):
        if rate <= -1.0: # Prevent division by zero or complex numbers
            return float('inf')
        val = 0.0
        for d, a in transactions:
            days = (d - start_date).days
            val += a / pow(1 + rate, days / 365.0)
        return val

    def xnpv_prime(rate):
        if rate <= -1.0:
            return float('inf')
        val = 0.0
        for d, a in transactions:
            days = (d - start_date).days
            if days == 0: continue
            term = days / 365.0
            val -= term * a / pow(1 + rate, term + 1)
        return val

    # Newton-Raphson
    rate = 0.1 # Initial guess 10%
    for _ in range(50):
        try:
            f_val = xnpv(rate)
            if abs(f_val) < 1e-5:
                # Converged
                return rate * 100
            
            df_val = xnpv_prime(rate)
            if df_val == 0: 
                break
                
            new_rate = rate - f_val / df_val
            if abs(new_rate - rate) < 1e-6:
                return new_rate * 100
            rate = new_rate
        except (ZeroDivisionError, OverflowError):
            break
            
    return 0.0

def get_portfolio_summary(db: Session, filter_type: str = None):
    """
    Returns the portfolio with current valuation and XIRR.
    Supports filtering by 'SIP' or 'LUMPSUM'.
    """
    # 1. Fetch Investments (Filtered)
    query = db.query(Investment)
    if filter_type and filter_type.lower() != 'all':
        # exact match for 'SIP' or 'LUMPSUM' (case sensitive in DB usually)
        # Assuming frontend sends 'SIP' or 'LUMPSUM'
        query = query.filter(Investment.type == filter_type)
    
    investments = query.all()
    
    # 2. Group by Scheme
    inv_map = {}
    scheme_codes = set()
    
    for inv in investments:
        if inv.scheme_code not in inv_map:
            inv_map[inv.scheme_code] = []
        inv_map[inv.scheme_code].append(inv)
        scheme_codes.add(inv.scheme_code)
        
    # 3. Fetch Schemes Details
    schemes = db.query(Scheme).filter(Scheme.scheme_code.in_(scheme_codes)).all()
    scheme_map = {s.scheme_code: s for s in schemes}

    summary = []
    total_invested = 0
    total_current_value = 0
    total_realized_pnl = 0.0
    global_cashflows = []
    
    for scheme_code, raw_txns in inv_map.items():
        scheme = scheme_map.get(scheme_code)
        if not scheme: continue 
        
        # Aggregate logic with Realized P&L (Average Cost Method)
        # Sort transactions by date to ensure correct cost basis evolution
        sorted_txns = sorted(raw_txns, key=lambda x: x.purchase_date)
        
        curr_units = 0.0
        curr_invested = 0.0
        scheme_realized_pnl = 0.0
        scheme_realized_value = 0.0
        
        # First Investment Date (for Duration calculation)
        first_invested_date = sorted_txns[0].purchase_date if sorted_txns else None

        total_units_sold = 0.0
        total_units_bought = 0.0 # New: Track total bought units
        gross_invested_amount = 0.0 # New: Track total money put in
        last_sell_date = None
        
        for txn in sorted_txns:
            if txn.units > 0: # BUY (SIP/LUMPSUM)
                curr_units += txn.units
                curr_invested += txn.amount
                total_units_bought += txn.units
                gross_invested_amount += txn.amount
            else: # SELL (REDEMPTION) - Units are negative
                units_sold = abs(txn.units)
                total_units_sold += units_sold
                last_sell_date = txn.purchase_date # Since sorted by date, this will update to latest
                
                if curr_units > 0:
                    # Calculate Average Cost at time of sale
                    avg_cost_per_unit = curr_invested / curr_units
                    cost_of_sold = avg_cost_per_unit * units_sold
                    
                    sale_value = abs(txn.amount) # Amount stored as negative for outflows
                    pnl = sale_value - cost_of_sold
                    scheme_realized_pnl += pnl
                    scheme_realized_value += sale_value
                    
                    # Reduce basis
                    curr_invested -= cost_of_sold
                    curr_units -= units_sold
                    
                    # Safety adjustments for floating point errors
                    if curr_units < 1e-5: 
                        curr_units = 0
                        curr_invested = 0
                else:
                    # Selling without units (shouldn't happen technically)
                    pass

        # Skip if units are zero AND no P&L (completely inactive)
        # But if we have Realized P&L, we might want to show it? 
        # For now, let's keep the user's existing logic of skipping sold-out schemes in active view,
        # OR better: The user wants "Realized P&L" on Dashboard. 
        # If we skip here, we lose the P&L stats.
        # However, the current view is "Holdings". Sold out schemes shouldn't appear in Holdings.
        # But we need to aggregate P&L globally.
        
        # We will continue to calculate, but flag for filtering
        is_active = curr_units > 0.0001
        
        # Average NAV
        avg_nav = curr_invested / curr_units if curr_units > 0 else 0
        
        # Original Buy NAV (Weighted Average of ALL buys)
        avg_buy_nav = gross_invested_amount / total_units_bought if total_units_bought > 0 else 0
        
        # Avg Sold NAV
        avg_sold_nav = scheme_realized_value / total_units_sold if total_units_sold > 0 else 0
        
        # Tax Status Calculation (Simplified)
        # Logic: If 'Equity' in category and duration > 365 days -> Long Term
        # Else if duration > 1095 days (3 years) -> Long Term
        # Else Short Term
        tax_status = "Short Term"
        days_held = 0
        if first_invested_date and last_sell_date:
            days_held = (last_sell_date - first_invested_date).days
            
        is_equity = scheme.category and ('Equity' in scheme.category or 'Index' in scheme.category)
        if is_equity:
            if days_held > 365:
                tax_status = "Long Term"
        else:
            if days_held > 1095:
                tax_status = "Long Term"

        # Current Value
        current_nav = scheme.net_asset_value
        current_val = curr_units * current_nav
        
        # XIRR Calculation
        scheme_txns = []
        for inv in raw_txns:
            scheme_txns.append((inv.purchase_date, -inv.amount))
            global_cashflows.append((inv.purchase_date, -inv.amount))
            
        nav_date = scheme.date if scheme.date else date.today()
        scheme_txns.append((nav_date, current_val))
        
        xirr_val = calculate_xirr(scheme_txns)
        
        # Absolute Return
        abs_return = current_val - curr_invested
        return_pct = (abs_return / curr_invested) * 100 if curr_invested > 0 else 0
        
        # Last Investment Details
        last_inv = sorted(raw_txns, key=lambda x: x.purchase_date, reverse=True)[0]
        last_invested_date = last_inv.purchase_date
        holding_period = last_inv.holding_period
        
        redemption_date = None
        if last_invested_date and holding_period:
            # Approximation: 365.25 days per year
            days = int(holding_period * 365.25)
            redemption_date = last_invested_date + timedelta(days=days)
            
        # Check if any transaction is SIP
        is_sip = any(i.type == 'SIP' for i in raw_txns)
        
        # 52-Week High/Low Calculation
        one_year_ago = date.today() - timedelta(days=365)
        
        # We need dates, so we must fetch the rows
        query_52w = db.query(NAVHistory).filter(
            NAVHistory.scheme_code == scheme_code,
            NAVHistory.date >= one_year_ago
        )
        
        high_52_row = query_52w.order_by(NAVHistory.net_asset_value.desc()).first()
        low_52_row = query_52w.order_by(NAVHistory.net_asset_value.asc()).first()

        min_52w = low_52_row.net_asset_value if low_52_row else current_nav
        max_52w = high_52_row.net_asset_value if high_52_row else current_nav
        
        min_52w_date = low_52_row.date if low_52_row else None
        max_52w_date = high_52_row.date if high_52_row else None
        
        summary.append({
            "scheme_code": scheme_code,
            "scheme_name": scheme.scheme_name,
            "category": scheme.category,
            "fund_house": scheme.fund_house,
            "invested_amount": curr_invested,
            "current_value": current_val,
            "total_units": curr_units,
            "average_nav": avg_nav,
            "current_nav": current_nav,
            "absolute_return": abs_return,
            "return_percentage": return_pct,
            "xirr": xirr_val,
            "last_invested_date": last_invested_date,
            "first_invested_date": first_invested_date,
            "last_sell_date": last_sell_date,
            "holding_period": holding_period,
            "redemption_date": redemption_date,
            "is_sip": is_sip,
            "min_52w": min_52w,
            "max_52w": max_52w,
            "min_52w_date": min_52w_date,
            "max_52w_date": max_52w_date,
            "min_52w_date": min_52w_date,
            "max_52w_date": max_52w_date,
            "realized_pnl": scheme_realized_pnl,
            "realized_value": scheme_realized_value,
            "total_units_sold": total_units_sold,
            "avg_sold_nav": avg_sold_nav,
            "total_units_bought": total_units_bought,
            "avg_buy_nav": avg_buy_nav,
            "gross_invested_amount": gross_invested_amount,
            "tax_status": tax_status
        })
        
        total_invested += curr_invested
        total_current_value += current_val
        total_realized_pnl += scheme_realized_pnl
        
    # Global Portfolio XIRR
    portfolio_xirr = 0.0
    if total_current_value > 0 or total_realized_pnl != 0:
        # Add current value as a cashflow at today's date
        calc_cashflows = list(global_cashflows)
        calc_cashflows.append((date.today(), total_current_value))
        portfolio_xirr = calculate_xirr(calc_cashflows)

    if total_current_value > 0 or total_realized_pnl != 0:
        return {
            "holdings": summary,
            "total_invested": total_invested,
            "total_current_value": total_current_value,
            "total_gain": total_current_value - total_invested,
            "total_realized_pnl": total_realized_pnl,
            "portfolio_xirr": portfolio_xirr
        }

def delete_scheme_history(db: Session, scheme_code: str):
    """
    Permanently delete all investment history for a scheme.
    Used for removing 'Sold' items from history.
    """
    # 1. Delete all investments for this scheme
    db.query(Investment).filter(Investment.scheme_code == scheme_code).delete()
    
    # 2. Delete portfolio aggregate entry
    db.query(Portfolio).filter(Portfolio.scheme_code == scheme_code).delete()
    
    db.commit()
    return True

def redeem_investment(db: Session, scheme_code: str, units: float, nav: float, date: date, remarks: str = None):
    # 1. Add Investment Entry (Negative Units/Amount)
    # Amount is negative (Outflow)
    amount = -(units * nav)
    
    new_redemption = Investment(
        scheme_code=scheme_code,
        type='REDEMPTION',
        amount=amount, 
        units=-units, # Negative units for redemption
        purchase_nav=nav,
        purchase_date=date,
        holding_period=None
    )
    
    db.add(new_redemption)
    db.commit()
    db.refresh(new_redemption)
    
    # 2. Update Portfolio Aggregate
    # We update the portfolio table item. 
    # Logic similar to add_investment but we need to handle reduction.
    
    portfolio_item = db.query(Portfolio).filter(Portfolio.scheme_code == scheme_code).first()
    if portfolio_item:
        # Avoid division by zero if it was somehow 0
        if portfolio_item.total_units > 0:
             # Reduce Invested Amount proportionally (Average Cost Method)
             # Invested Amount remains proportional to units if we consider 'Remaining Cost'
             # Or we can just calculate: New Invested = (Old Invested / Old Units) * New Units
             
             avg_cost = portfolio_item.invested_amount / portfolio_item.total_units
             cost_removed = avg_cost * units
             
             portfolio_item.total_units -= units
             portfolio_item.invested_amount -= cost_removed
             
             # Safety
             if portfolio_item.total_units < 1e-5:
                 portfolio_item.total_units = 0
                 portfolio_item.invested_amount = 0
        else:
             portfolio_item.total_units = 0
             portfolio_item.invested_amount = 0

        db.commit()
        db.refresh(portfolio_item)
        
    return new_redemption

def add_to_watchlist(db: Session, scheme_code: str, group_id: int = None, target_nav: float = None, units: float = 0.0, invested_amount: float = 0.0):
    """Adds a scheme to the watchlist with optional group and details."""
    # Check if already in watchlist WITH THE SAME GROUP (allow same fund in different groups)
    # ONLY check for ACTIVE items. If an item is SOLD, we allow adding a new ACTIVE one.
    existing = db.query(Watchlist).filter(
        Watchlist.scheme_code == scheme_code,
        Watchlist.group_id == group_id,
        Watchlist.is_sold == False
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
            "category": item.scheme.category,
            "fund_house": item.scheme.fund_house,
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

def update_investment(db: Session, investment_id: int, scheme_code: str, invest_type: str, amount: float, purchase_nav: float, purchase_date: date, holding_period: float = None):
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
    investment.holding_period = holding_period
    
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
