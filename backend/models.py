from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Scheme(Base):
    __tablename__ = "schemes"

    scheme_code = Column(String, primary_key=True, index=True)
    scheme_name = Column(String)
    isin_div_payout = Column(String, nullable=True)
    isin_div_reinvestment = Column(String, nullable=True)
    net_asset_value = Column(Float)
    date = Column(Date)
    last_updated = Column(Date, default=datetime.date.today)

class Investment(Base):
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    scheme_code = Column(String, ForeignKey("schemes.scheme_code"))
    type = Column(String) # SIP or LUMPSUM
    amount = Column(Float)
    units = Column(Float)
    purchase_nav = Column(Float)
    purchase_date = Column(Date)
    
    scheme = relationship("Scheme")

class Portfolio(Base):
    """Aggregated holding for a scheme"""
    __tablename__ = "portfolio"
    
    id = Column(Integer, primary_key=True, index=True)
    scheme_code = Column(String, ForeignKey("schemes.scheme_code"))
    total_units = Column(Float, default=0.0)
    average_nav = Column(Float, default=0.0)
    invested_amount = Column(Float, default=0.0)

    scheme = relationship("Scheme")

class WatchlistGroup(Base):
    __tablename__ = "watchlist_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(Date, default=datetime.date.today)

class Watchlist(Base):
    __tablename__ = "watchlist"
    
    id = Column(Integer, primary_key=True, index=True)
    scheme_code = Column(String, ForeignKey("schemes.scheme_code"))
    group_id = Column(Integer, ForeignKey("watchlist_groups.id"), nullable=True)
    target_nav = Column(Float, nullable=True)
    units = Column(Float, default=0.0)
    invested_amount = Column(Float, default=0.0)
    added_on = Column(Date, default=datetime.date.today)
    
    # Sold / Realised P&L
    is_sold = Column(Boolean, default=False)
    sold_nav = Column(Float, nullable=True)
    sold_date = Column(Date, nullable=True)
    
    scheme = relationship("Scheme")
    group = relationship("WatchlistGroup")

class NAVHistory(Base):
    __tablename__ = "nav_history"

    id = Column(Integer, primary_key=True, index=True)
    scheme_code = Column(String, ForeignKey("schemes.scheme_code"))
    date = Column(Date)
    net_asset_value = Column(Float)
    
    # Relationship
    scheme = relationship("Scheme")

    # Composite unique constraint to prevent duplicate NAVs for same date/scheme
    # We can do this via __table_args__
    from sqlalchemy import UniqueConstraint
    __table_args__ = (
        UniqueConstraint('scheme_code', 'date', name='uq_scheme_date_history'),
    )

