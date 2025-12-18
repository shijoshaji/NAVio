import requests
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Scheme
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

AMFI_NAV_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"

def fetch_nav_data():
    """Fetches NAV data from AMFI website."""
    try:
        response = requests.get(AMFI_NAV_URL, timeout=10)
        response.raise_for_status()
        return response.text
    except Exception as e:
        logger.error(f"Error fetching NAV data: {e}")
        raise

def parse_and_sync_nav_data(db: Session, data: str):
    """Parses the AMFI text data and updates the database."""
    from models import Investment, Watchlist, NAVHistory
    
    # 1. Get Active Schemes (Present in Portfolio or Watchlist)
    active_schemes = set()
    
    investments = db.query(Investment.scheme_code).distinct().all()
    for (code,) in investments:
        active_schemes.add(code)
        
    watchlist = db.query(Watchlist.scheme_code).distinct().all()
    for (code,) in watchlist:
        active_schemes.add(code)
    
    lines = data.split('\n')
    count = 0
    
    for line in lines:
        if not line or ";" not in line:
            continue
            
        parts = line.split(';')
        if len(parts) < 6:
            continue
            
        # Check if it's the header or a category line
        if not parts[0].isdigit():
            continue

        try:
            scheme_code = parts[0].strip()
            isin_growth = parts[1].strip()
            isin_reinvest = parts[2].strip()
            scheme_name = parts[3].strip()
            details = parts[4].strip()
            date_str = parts[5].strip()
            
            try:
                net_asset_value = float(details)
            except ValueError:
                # specific case handling or simply skip if NAV is N.A.
                continue

            try:
                date_obj = datetime.strptime(date_str, "%d-%b-%Y").date()
            except ValueError:
                 continue

            # Upsert logic for Scheme Master
            scheme = db.query(Scheme).filter(Scheme.scheme_code == scheme_code).first()
            if not scheme:
                scheme = Scheme(
                    scheme_code=scheme_code,
                    scheme_name=scheme_name,
                    isin_div_payout=isin_growth,
                    isin_div_reinvestment=isin_reinvest,
                    net_asset_value=net_asset_value,
                    date=date_obj,
                    last_updated=datetime.now().date()
                )
                db.add(scheme)
            else:
                scheme.net_asset_value = net_asset_value
                scheme.date = date_obj
                scheme.last_updated = datetime.now().date()
            
            # Upsert logic for NAV History (Only Active Schemes)
            if scheme_code in active_schemes:
                # Check if history exists for this date/scheme
                history_entry = db.query(NAVHistory).filter(
                    NAVHistory.scheme_code == scheme_code,
                    NAVHistory.date == date_obj
                ).first()
                
                if not history_entry:
                    history_entry = NAVHistory(
                        scheme_code=scheme_code,
                        date=date_obj,
                        net_asset_value=net_asset_value
                    )
                    db.add(history_entry)
            
            count += 1
            if count % 100 == 0:
                # Commit in batches
                db.commit()

        except Exception as e:
            logger.error(f"Error parsing line: {line} - {e}")
            continue
            
    db.commit()
    
    # --- PHASE 2: Gap Recovery (Backfill) ---
    logger.info(f"Phase 1 Complete. Updated {count} schemes. Starting Phase 2: Gap Recovery for {len(active_schemes)} active schemes.")
    
    for code in active_schemes:
        try:
            backfill_scheme_history(db, code)
        except Exception as e:
            logger.error(f"Failed to backfill history for {code}: {e}")
            
    return count

def fetch_scheme_history_api(scheme_code: str):
    """Fetches historical NAV data from mfapi.in"""
    url = f"https://api.mfapi.in/mf/{scheme_code}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"API fetch error for {scheme_code}: {e}")
    return None

def backfill_scheme_history(db: Session, scheme_code: str):
    """Checks for gaps in history and fills them using external API."""
    from models import NAVHistory
    from datetime import timedelta, date
    
    # 1. Check coverage
    # Get last 2 dates to check for recent gaps
    last_entries = db.query(NAVHistory.date).filter(
        NAVHistory.scheme_code == scheme_code
    ).order_by(NAVHistory.date.desc()).limit(2).all()
    
    # Check if we need to backfill due to OLD start dates (User requested backdated tracking)
    # Find the earliest 'added_on' date for this scheme in Watchlist or Investment
    from models import Watchlist, Investment
    earliest_track_date = db.query(func.min(Watchlist.added_on)).filter(Watchlist.scheme_code == scheme_code).scalar()
    earliest_inv_date = db.query(func.min(Investment.purchase_date)).filter(Investment.scheme_code == scheme_code).scalar()
    
    required_start_date = None
    if earliest_track_date and earliest_inv_date:
        required_start_date = min(earliest_track_date, earliest_inv_date)
    elif earliest_track_date:
        required_start_date = earliest_track_date
    elif earliest_inv_date:
        required_start_date = earliest_inv_date
        
    # Get earliest history date we currently have
    earliest_history = db.query(func.min(NAVHistory.date)).filter(NAVHistory.scheme_code == scheme_code).scalar()
    
    needs_backfill = False
    
    if not last_entries:
        needs_backfill = True
    elif len(last_entries) == 1:
        needs_backfill = True
    else:
        # Check Recent Gap
        latest = last_entries[0][0]
        previous = last_entries[1][0]
        if (latest - previous).days >= 5:
            needs_backfill = True
            
    # Check History Gap (Missing Head)
    if required_start_date and earliest_history:
        if required_start_date < earliest_history:
             logger.info(f"Backfill needed: Earliest history {earliest_history} is newer than required start {required_start_date}")
             needs_backfill = True
    elif required_start_date and not earliest_history:
        needs_backfill = True
             
    if not needs_backfill:
        return

    # 2. Fetch full history
    logger.info(f"Triggering backfill for {scheme_code}...")
    data = fetch_scheme_history_api(scheme_code)
    
    if not data or 'data' not in data:
        return

    # 3. Process and Insert
    nav_list = data.get('data', [])
    
    # Optimization: Get ALL existing dates for this scheme into a SET for O(1) lookup
    existing_dates = set([r[0] for r in db.query(NAVHistory.date).filter(NAVHistory.scheme_code == scheme_code).all()])
    
    added_count = 0
    new_rows = []
    
    for entry in nav_list:
        try:
            d_str = entry.get('date')
            nav_val = float(entry.get('nav'))
            row_date = datetime.strptime(d_str, "%d-%m-%Y").date()
            
            if row_date in existing_dates:
                continue
                
            new_rows.append(NAVHistory(
                scheme_code=scheme_code,
                date=row_date,
                net_asset_value=nav_val
            ))
            added_count += 1
            if added_count > 3000: # Safety limit per batch
                break
                
        except Exception as e:
            continue
            
    if new_rows:
        db.bulk_save_objects(new_rows)
        db.commit()
        logger.info(f"Backfilled {len(new_rows)} days of history for {scheme_code}")
