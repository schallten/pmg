from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

# Dependency to authenticate user
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "").strip()
    user = db.query(User).filter(User.api_key == token).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return user
