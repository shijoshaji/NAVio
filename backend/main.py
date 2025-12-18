from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
from services.nav import fetch_nav_data, parse_and_sync_nav_data

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mutual Fund Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev, allow all. In prod, specify frontend URL.
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

class WatchlistBase(BaseModel):
    scheme_code: str
    group_id: Optional[int] = None
    target_nav: Optional[float] = None
    units: Optional[float] = 0.0
    invested_amount: Optional[float] = 0.0

class GroupBase(BaseModel):
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
def get_portfolio(db: Session = Depends(get_db)):
    """Get portfolio summary with current valuation"""
    return portfolio.get_portfolio_summary(db)

@app.post("/api/investments")
def add_investment(investment: InvestmentBase, db: Session = Depends(get_db)):
    """Add a new investment (SIP or Lumpsum)"""
    return portfolio.add_investment(
        db,
        scheme_code=investment.scheme_code,
        invest_type=investment.type,
        amount=investment.amount,
        purchase_nav=investment.purchase_nav,
        purchase_date=investment.purchase_date
    )

@app.get("/api/investments")
def get_investments(type: Optional[str] = None, db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    query = db.query(models.Investment).options(joinedload(models.Investment.scheme))
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
        purchase_date=investment.purchase_date
    )
    if not updated_investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    return updated_investment

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
