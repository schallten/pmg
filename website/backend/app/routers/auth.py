from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from datetime import datetime
import hashlib
from ..database import get_db
from ..models import User
from ..dependencies import get_current_user

router = APIRouter(prefix="/api")

@router.get("/authenticate")
def authorization(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {
        "message": "User authenticated successfully",
        "username": user.username
    }

@router.post("/signup")
def signup(
    username: str = Form(...),
    email: str = Form(...),
    db: Session = Depends(get_db)
) -> dict[str, str]:
    
    existing_user = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    api_key = hashlib.sha256(f"{username}{email}{datetime.utcnow()}".encode()).hexdigest()
    
    new_user = User(
        username=username,
        email=email,
        api_key=api_key
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "User registered successfully",
        "api_key": new_user.api_key
    }


@router.post("/login")
def login(
    username: str = Form(...),
    email: str = Form(...),
    db: Session = Depends(get_db)
) -> dict[str, str]:
    
    user = db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or email")
    
    return {
        "message": "Login successful",
        "api_key": user.api_key
    }
