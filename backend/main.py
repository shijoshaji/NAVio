from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
from services.nav import fetch_nav_data, parse_and_sync_nav_data

# Create database tables
Base.metadata.create_all(bind=engine)

# Auto-migration for fund_house column
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if 'schemes' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('schemes')]
        if 'fund_house' not in columns:
            print("Migrating DB: Adding fund_house column...")
            with engine.connect() as connection:
                connection.execute(text("ALTER TABLE schemes ADD COLUMN fund_house VARCHAR"))
                try:
                    connection.commit()
                except:
                    pass # Some drivers auto-commit or don't support it on DDL
            print("Migration complete.")
            
    # Auto-migration for holding_period column in investments
    if 'investments' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('investments')]
        if 'holding_period' not in columns:
            print("Migrating DB: Adding holding_period column to investments...")
            with engine.connect() as connection:
                connection.execute(text("ALTER TABLE investments ADD COLUMN holding_period FLOAT"))
                try:
                    connection.commit()
                except:
                    pass
            print("Migration complete.")
            
    # Auto-migration for account_name column in investments
    if 'investments' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('investments')]
        if 'account_name' not in columns:
            print("Migrating DB: Adding account_name column to investments...")
            with engine.connect() as connection:
                connection.execute(text("ALTER TABLE investments ADD COLUMN account_name VARCHAR DEFAULT 'Default'"))
                try:
                    connection.commit()
                except:
                    pass
            print("Migration complete.")
            
    # Auto-migration for account_name column in portfolio
    if 'portfolio' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('portfolio')]
        if 'account_name' not in columns:
            print("Migrating DB: Adding account_name column to portfolio...")
            with engine.connect() as connection:
                connection.execute(text("ALTER TABLE portfolio ADD COLUMN account_name VARCHAR DEFAULT 'Default'"))
                try:
                    connection.commit()
                except:
                    pass
            print("Migration complete.")
            
    # Auto-migration: Populate accounts table from existing data
    if 'accounts' in inspector.get_table_names():
        with Session(engine) as session:
            # 1. Ensure 'Default' exists
            if not session.query(models.Account).filter(models.Account.name == 'Default').first():
                session.add(models.Account(name='Default'))
                print("Added Default account.")
            
            # 2. Sync from Investments
            if 'investments' in inspector.get_table_names():
                inv_accounts = session.query(models.Investment.account_name).distinct().all()
                for (acc_name,) in inv_accounts:
                    if acc_name and not session.query(models.Account).filter(models.Account.name == acc_name).first():
                         session.add(models.Account(name=acc_name))
                         print(f"Migrated account: {acc_name}")

            # 3. Sync from Portfolio
            if 'portfolio' in inspector.get_table_names():
                port_accounts = session.query(models.Portfolio.account_name).distinct().all()
                for (acc_name,) in port_accounts:
                    if acc_name and not session.query(models.Account).filter(models.Account.name == acc_name).first():
                         session.add(models.Account(name=acc_name))
                         print(f"Migrated account: {acc_name}")
            
            try:
                session.commit()
                print("Account population complete.")
            except Exception as e:
                print(f"Account population failed: {e}")
                session.rollback()
            
except Exception as e:
    print(f"Migration check failed: {e}")

app = FastAPI(title="Mutual Fund Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"], # Explicitly allow frontend ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Mutual Fund Tracker API is running"}

@app.post("/api/sync-nav")
def sync_nav(db: Session = Depends(get_db)):
    """Fetches NAV data from AMFI and updates the database."""
    try:
        data = fetch_nav_data()
        count = parse_and_sync_nav_data(db, data)
        return {"message": f"Successfully synced {count} schemes."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
from datetime import date
from typing import Optional
from services import portfolio

class InvestmentBase(BaseModel):
    scheme_code: str
    type: str # "SIP" or "LUMPSUM"
    amount: float
    purchase_nav: float
    purchase_date: date
    holding_period: Optional[float] = None
    account_name: Optional[str] = "Default"

class SIPMandateBase(BaseModel):
    scheme_code: str
    account_name: Optional[str] = "Default"
    sip_amount: float
    start_date: date
    duration_years: float
    status: Optional[str] = "ACTIVE"

@app.post("/api/sips/mandates")
def create_sip_mandate(mandate: SIPMandateBase, db: Session = Depends(get_db)):
    db_mandate = models.SIPMandate(
        scheme_code=mandate.scheme_code,
        account_name=mandate.account_name,
        sip_amount=mandate.sip_amount,
        start_date=mandate.start_date,
        duration_years=mandate.duration_years,
        status=mandate.status
    )
    db.add(db_mandate)
    db.commit()
    db.refresh(db_mandate)
    return db_mandate

@app.get("/api/sips/mandates")
def get_sip_mandates(active_only: bool = False, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    query = db.query(models.SIPMandate).options(joinedload(models.SIPMandate.scheme))
    if active_only:
        query = query.filter(models.SIPMandate.status == 'ACTIVE')
    return query.all()

@app.put("/api/sips/mandates/{mandate_id}")
def update_sip_mandate(mandate_id: int, mandate: SIPMandateBase, db: Session = Depends(get_db)):
    db_mandate = db.query(models.SIPMandate).filter(models.SIPMandate.id == mandate_id).first()
    if not db_mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
    
    db_mandate.scheme_code = mandate.scheme_code
    db_mandate.account_name = mandate.account_name
    db_mandate.sip_amount = mandate.sip_amount
    db_mandate.start_date = mandate.start_date
    db_mandate.duration_years = mandate.duration_years
    db_mandate.status = mandate.status
    
    db.commit()
    db.refresh(db_mandate)
    return db_mandate

@app.delete("/api/sips/mandates/{mandate_id}")
def delete_sip_mandate(mandate_id: int, db: Session = Depends(get_db)):
    db_mandate = db.query(models.SIPMandate).filter(models.SIPMandate.id == mandate_id).first()
    if not db_mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")
        
    # Hard Delete: Remove all historical SIP investments for this strategy
    # to clean up the portfolio stats
    related_investments = db.query(models.Investment).filter(
        models.Investment.scheme_code == db_mandate.scheme_code,
        models.Investment.account_name == db_mandate.account_name,
        models.Investment.type == 'SIP'
    ).all()
    
    count = 0
    for inv in related_investments:
        portfolio.delete_investment(db, inv.id)
        count += 1
        
    db.delete(db_mandate)
    db.commit()
    return {"message": f"Mandate and {count} historical transactions deleted"}

class ConvertSipRequest(BaseModel):
    start_date: date
    duration_years: float

@app.post("/api/sips/mandates/{mandate_id}/convert")
def convert_sip_to_lumpsum(mandate_id: int, request: ConvertSipRequest, db: Session = Depends(get_db)):
    """
    Stops the SIP mandate and converts all its historical 'SIP' 
    investments to 'LUMPSUM' with a new defined plan.
    """
    db_mandate = db.query(models.SIPMandate).filter(models.SIPMandate.id == mandate_id).first()
    if not db_mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    # 1. Update Mandate Status and plan metadata (New Plan Baseline)
    db_mandate.status = 'COMPLETED'
    db_mandate.start_date = request.start_date
    db_mandate.duration_years = request.duration_years

    # 2. Update all historical investments for this strategy
    # Set type to LUMPSUM, update the holding_period plan, AND RESET purchase_date to new start_date
    updated_count = db.query(models.Investment).filter(
        models.Investment.scheme_code == db_mandate.scheme_code,
        models.Investment.account_name == db_mandate.account_name,
        models.Investment.type == 'SIP'
    ).update({
        models.Investment.type: 'LUMPSUM',
        models.Investment.holding_period: request.duration_years,
        models.Investment.purchase_date: request.start_date
    }, synchronize_session=False)

    db.commit()
    return {
        "message": f"SIP converted to Lumpsum. Strategy stopped and {updated_count} transactions updated.",
        "updated_transactions": updated_count
    }

class RedeemRequest(BaseModel):
    scheme_code: str
    units: float
    nav: float
    date: date
    remarks: Optional[str] = None
    account_name: Optional[str] = "Default"

class WatchlistBase(BaseModel):
    scheme_code: str
    group_id: Optional[int] = None
    target_nav: Optional[float] = None
    units: Optional[float] = 0.0
    invested_amount: Optional[float] = 0.0

class GroupBase(BaseModel):
    name: str

class AccountBase(BaseModel):
    name: str

@app.post("/api/watchlist")
def add_to_watchlist(item: WatchlistBase, db: Session = Depends(get_db)):
    return portfolio.add_to_watchlist(
        db, 
        item.scheme_code, 
        group_id=item.group_id,
        target_nav=item.target_nav,
        units=item.units,
        invested_amount=item.invested_amount
    )

class SellItemRequest(BaseModel):
    sold_nav: float
    sold_date: date

class RedeemRequest(BaseModel):
    scheme_code: str
    units: float
    nav: float
    date: date
    remarks: Optional[str] = None
    account_name: Optional[str] = "Default"

@app.delete("/api/watchlist/item/{item_id}")
def delete_watchlist_item(item_id: int, db: Session = Depends(get_db)):
    result = portfolio.delete_watchlist_item(db, item_id)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

@app.post("/api/watchlist/item/{item_id}/sell")
def mark_watchlist_item_sold(item_id: int, request: SellItemRequest, db: Session = Depends(get_db)):
    result = portfolio.mark_watchlist_item_sold(db, item_id, request.sold_nav, request.sold_date)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return result

class UpdateDateRequest(BaseModel):
    date: date

@app.patch("/api/watchlist/item/{item_id}/date")
def update_watchlist_item_date(item_id: int, request: UpdateDateRequest, db: Session = Depends(get_db)):
    result = portfolio.update_watchlist_item_date(db, item_id, request.date)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return result

@app.get("/api/watchlist")
def get_watchlist(db: Session = Depends(get_db)):
    return portfolio.get_watchlist(db)

@app.get("/api/watchlist/groups")
def get_watchlist_groups(db: Session = Depends(get_db)):
    return portfolio.get_watchlist_groups(db)

@app.post("/api/watchlist/groups")
def create_watchlist_group(group: GroupBase, db: Session = Depends(get_db)):
    return portfolio.create_watchlist_group(db, group.name)

@app.put("/api/watchlist/groups/{group_id}")
def update_watchlist_group(group_id: int, group: GroupBase, db: Session = Depends(get_db)):
    result = portfolio.update_watchlist_group(db, group_id, group.name)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    return result

@app.delete("/api/watchlist/groups/{group_id}")
def delete_watchlist_group(group_id: int, db: Session = Depends(get_db)):
    result = portfolio.delete_watchlist_group(db, group_id)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"message": "Group deleted successfully"}

@app.get("/api/portfolio")
def get_portfolio(type: Optional[str] = None, db: Session = Depends(get_db)):
    """Get portfolio summary with current valuation"""
    return portfolio.get_portfolio_summary(db, filter_type=type)

@app.get("/api/accounts")
def get_accounts(db: Session = Depends(get_db)):
    """Get list of defined accounts with item counts."""
    accounts = db.query(models.Account).order_by(models.Account.name).all()
    result = []
    for acc in accounts:
        # Count investments (active tracking entries)
        inv_count = db.query(models.Investment).filter(models.Investment.account_name == acc.name).count()
        # Count portfolio items (history/aggregated)
        port_count = db.query(models.Portfolio).filter(models.Portfolio.account_name == acc.name).count()
        
        result.append({
            "id": acc.id, 
            "name": acc.name, 
            "item_count": inv_count, # Only block on Active Investments
            "history_count": port_count
        })
    return result

@app.post("/api/accounts")
def create_account(account: AccountBase, db: Session = Depends(get_db)):
    """Create a new account"""
    existing = db.query(models.Account).filter(models.Account.name == account.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists")
    
    new_account = models.Account(name=account.name)
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return {"id": new_account.id, "name": new_account.name, "item_count": 0, "history_count": 0}

@app.put("/api/accounts/{account_id}")
def update_account(account_id: int, account: AccountBase, db: Session = Depends(get_db)):
    """Rename an account and cascade changes to investments."""
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Cascade rename
    old_name = db_account.name
    new_name = account.name
    
    if old_name != new_name:
        # Check if new name exists
        if db.query(models.Account).filter(models.Account.name == new_name).first():
            raise HTTPException(status_code=400, detail="Account name already exists")
            
        db_account.name = new_name
        
        # Update Investments
        db.query(models.Investment).filter(models.Investment.account_name == old_name).update({models.Investment.account_name: new_name})
        
        # Update Portfolio
        db.query(models.Portfolio).filter(models.Portfolio.account_name == old_name).update({models.Portfolio.account_name: new_name})
        
    db.commit()
    db.refresh(db_account)
    
    # helper count
    inv_count = db.query(models.Investment).filter(models.Investment.account_name == new_name).count()
    return {"id": db_account.id, "name": db_account.name, "item_count": inv_count}

@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete an account. Block if ACTIVE investments. Move History to Default."""
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if db_account.name == 'Default':
        raise HTTPException(status_code=400, detail="Cannot delete Default account")

    # Check for ACTIVE investments
    inv_count = db.query(models.Investment).filter(models.Investment.account_name == db_account.name).count()
    
    if inv_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete account '{db_account.name}' because it has {inv_count} active investments.")
        
    # If only history exists (portfolio items), move them to Default so they are not orphaned
    db.query(models.Portfolio).filter(models.Portfolio.account_name == db_account.name).update({models.Portfolio.account_name: 'Default'})
    
    db.delete(db_account)
    db.commit()
    return {"message": "Account deleted successfully"}

@app.delete("/api/portfolio/scheme/{scheme_code}")
def delete_scheme_history(scheme_code: str, db: Session = Depends(get_db)):
    """Permanently delete all transaction history for a scheme"""
    result = portfolio.delete_scheme_history(db, scheme_code)
    if not result:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return {"message": "Scheme history deleted"}

@app.post("/api/investments")
def add_investment(investment: InvestmentBase, db: Session = Depends(get_db)):
    """Add a new investment (SIP or Lumpsum)"""
    return portfolio.add_investment(
        db,
        scheme_code=investment.scheme_code,
        invest_type=investment.type,
        amount=investment.amount,
        purchase_nav=investment.purchase_nav,
        purchase_date=investment.purchase_date,
        holding_period=investment.holding_period,
        account_name=investment.account_name
    )

@app.post("/api/redeem")
def redeem_investment(redemption: RedeemRequest, db: Session = Depends(get_db)):
    """Redeem (sell) mutual fund units"""
    return portfolio.redeem_investment(
        db,
        scheme_code=redemption.scheme_code,
        units=redemption.units,
        nav=redemption.nav,
        date=redemption.date,
        remarks=redemption.remarks,
        account_name=redemption.account_name
    )

@app.get("/api/investments")
def get_investments(type: Optional[str] = None, active_only: bool = False, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    query = db.query(models.Investment).options(joinedload(models.Investment.scheme))
    
    if active_only:
        # Join with Portfolio to check if scheme is active (units > 0)
        query = query.join(
            models.Portfolio, 
            (models.Investment.scheme_code == models.Portfolio.scheme_code) & 
            (models.Investment.account_name == models.Portfolio.account_name)
        ).filter(models.Portfolio.total_units >= 0.01)

    if type:
        query = query.filter(models.Investment.type == type)
    return query.order_by(models.Investment.purchase_date.desc()).all()

@app.delete("/api/investments/{investment_id}")
def delete_investment(investment_id: int, db: Session = Depends(get_db)):
    """Delete an investment entry"""
    result = portfolio.delete_investment(db, investment_id)
    if not result:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"message": "Investment deleted successfully"}

@app.put("/api/investments/{investment_id}")
def update_investment(investment_id: int, investment: InvestmentBase, db: Session = Depends(get_db)):
    """Update an existing investment"""
    updated_investment = portfolio.update_investment(
        db,
        investment_id=investment_id,
        scheme_code=investment.scheme_code,
        invest_type=investment.type,
        amount=investment.amount,
        purchase_nav=investment.purchase_nav,
        purchase_date=investment.purchase_date,
        holding_period=investment.holding_period,
        account_name=investment.account_name
    )
    if not updated_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    return updated_investment

@app.post("/api/redeem")
def redeem_investment(request: RedeemRequest, db: Session = Depends(get_db)):
    """Redeem (Sell) units from an investment"""
    # Calculate negative amount for redemption
    # add_investment calculates units = amount / nav
    # So if we want -ve units, we need -ve amount
    amount = -1 * (request.units * request.nav)
    
    return portfolio.add_investment(
        db,
        scheme_code=request.scheme_code,
        invest_type="REDEMPTION",
        amount=amount,
        purchase_nav=request.nav,
        purchase_date=request.date,
        account_name=request.account_name
    )

@app.get("/api/schemes/search")
def search_schemes(query: str = "", limit: int = 50, db: Session = Depends(get_db)):
    """Search schemes by name"""
    schemes = db.query(models.Scheme).filter(
        models.Scheme.scheme_name.like(f"%{query}%")
    ).limit(limit).all()
    return schemes

@app.get("/api/schemes/amc")
def get_amcs(db: Session = Depends(get_db)):
    """Get list of unique AMC names"""
    schemes = db.query(models.Scheme.scheme_name).distinct().all()
    amcs = set()
    
    for (name,) in schemes:
        # Extract AMC name - usually the first few words before common keywords
        # Common patterns: "AMC_NAME Fund Name - Plan - Option"
        name_lower = name.lower()
        
        # Split by common delimiters
        if ' - ' in name:
            amc = name.split(' - ')[0].strip()
        else:
            # Take first 2-4 words as AMC name
            words = name.split()
            if len(words) >= 2:
                # Look for common fund type keywords to stop
                stop_words = ['fund', 'scheme', 'yojana', 'yojna', 'plan']
                amc_words = []
                for word in words:
                    if word.lower() in stop_words:
                        break
                    amc_words.append(word)
                if amc_words:
                    amc = ' '.join(amc_words[:4])  # Max 4 words
                else:
                    amc = ' '.join(words[:3])
            else:
                amc = name
        
        if amc and len(amc) > 2:  # Avoid very short names
            amcs.add(amc.strip())
    
    return sorted(list(amcs))

@app.get("/api/schemes")
def get_schemes_by_amc(amc: Optional[str] = None, db: Session = Depends(get_db)):
    """Get schemes filtered by AMC"""
    query = db.query(models.Scheme)
    if amc:
        query = query.filter(models.Scheme.scheme_name.like(f"{amc}%"))
    return query.limit(100).all()

@app.get("/api/sync-status")
def get_sync_status(db: Session = Depends(get_db)):
    """Get last sync date"""
    latest_scheme = db.query(models.Scheme).order_by(
        models.Scheme.last_updated.desc()
    ).first()
    if latest_scheme:
        return {
            "last_sync": latest_scheme.last_updated.isoformat(),
            "total_schemes": db.query(models.Scheme).count()
        }
    return {"last_sync": None, "total_schemes": 0}

@app.get("/api/schemes/code/{scheme_code}")
def get_scheme_by_code(scheme_code: str, db: Session = Depends(get_db)):
    """Get scheme by exact code"""
    scheme = db.query(models.Scheme).filter(
        models.Scheme.scheme_code == scheme_code
    ).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return scheme

@app.get("/api/schemes/{scheme_code}/history")
def get_scheme_history(scheme_code: str, db: Session = Depends(get_db)):
    """Get historical NAV data for a scheme"""
    history = db.query(models.NAVHistory).filter(
        models.NAVHistory.scheme_code == scheme_code
    ).order_by(models.NAVHistory.date.desc()).all()
    return history

@app.get("/api/schemes/{scheme_code}/stats")
def get_scheme_stats(scheme_code: str, db: Session = Depends(get_db)):
    """Get 52-week High/Low statistics"""
    from datetime import timedelta, date
    
    today = date.today()
    one_year_ago = today - timedelta(days=365)
    
    # Query history for the last year
    history = db.query(models.NAVHistory).filter(
        models.NAVHistory.scheme_code == scheme_code,
        models.NAVHistory.date >= one_year_ago
    ).all()
    
    if not history:
        # Fallback to current scheme NAV if no history
        scheme = db.query(models.Scheme).filter(models.Scheme.scheme_code == scheme_code).first()
        if scheme:
            return {
                "high_52w": scheme.net_asset_value,
                "low_52w": scheme.net_asset_value,
                "current_nav": scheme.net_asset_value
            }
        return {"high_52w": 0, "low_52w": 0, "current_nav": 0}
        
    navs = [h.net_asset_value for h in history]
    # Add current NAV from scheme master to ensure latest is included
    scheme = db.query(models.Scheme).filter(models.Scheme.scheme_code == scheme_code).first()
    if scheme:
        navs.append(scheme.net_asset_value)
        
    return {
        "high_52w": max(navs),
        "low_52w": min(navs),
        "current_nav": scheme.net_asset_value if scheme else 0
    }
@app.get("/api/system/version")
def get_system_version():
    try:
        import os
        import re
        
        release_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'release-notes')
        if not os.path.exists(release_dir):
            return {"version": "Unknown"}
            
        files = [f for f in os.listdir(release_dir) if f.endswith('.md') and f.startswith('v')]
        if not files:
            return {"version": "Unknown"}
            
        # Parse versions
        versions = []
        for f in files:
            # Extract just the version part v1.2.3.md -> 1.2.3
            match = re.search(r'v(\d+\.\d+\.\d+)', f)
            if match:
                versions.append(match.group(1))
                
        if not versions:
            return {"version": "Unknown"}
            
        # Sort versions semantically
        versions.sort(key=lambda s: [int(u) for u in s.split('.')])
        latest_version = f"v{versions[-1]}"
        
        return {"version": latest_version}
    except Exception as e:
        print(f"Error fetching version: {e}")
        return {"version": "Unknown"}
