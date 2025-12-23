from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import hashlib
import os
import json
import time
from ..database import get_db
from ..models import User, Project
from ..consistency import run_consistency_check_if_needed

router = APIRouter(prefix="/api")

CACHE_FILE = "temp/latest_repos_cache.json"
CACHE_EXPIRATION = 3600  # 1 hour in seconds

@router.get("/search/{query}")
def search_projects(
    query: str,
    db: Session = Depends(get_db)
):
    try:
        projects = db.query(Project).filter(Project.project_name.ilike(f"%{query}%")).all()
        
        result = []
        for project in projects:
            owner = db.query(User).filter(User.id == project.user_id).first()
            if not owner:
                continue
            result.append({
                "username": owner.username,
                "project_name": project.project_name,
                "created_at": project.created_at.isoformat(),
                "last_updated": project.last_updated.isoformat(),
                "view_url": f"/api/repo/{owner.username}/{project.project_name}"
            })
        
        return {
            "results": result
        }
    
    except Exception as e:
        print(f"Error searching projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search projects: {str(e)}")

@router.get("/latest-repos")
def get_latest_repos(
    db: Session = Depends(get_db)
):
    # Run consistency check with cooldown
    run_consistency_check_if_needed(db)

    try:
        # Check if cache exists and is valid
        if os.path.exists(CACHE_FILE):
            file_age = time.time() - os.path.getmtime(CACHE_FILE)
            if file_age < CACHE_EXPIRATION:
                try:
                    with open(CACHE_FILE, "r") as f:
                        cached_data = json.load(f)
                    return cached_data
                except Exception as cache_err:
                    print(f"Warning: Failed to read cache: {cache_err}")

        # If cache doesn't exist or is expired, query DB
        results = db.query(Project, User.username).join(
            User, Project.user_id == User.id
        ).order_by(
            Project.last_updated.desc()
        ).limit(5).all()
        
        project_list = []
        for project, username in results:
            project_list.append({
                "username": username,
                "project_name": project.project_name,
                "created_at": project.created_at.isoformat(),
                "last_updated": project.last_updated.isoformat()
            })
        
        response_data = {"projects": project_list}

        # Update cache
        try:
            os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
            with open(CACHE_FILE, "w") as f:
                json.dump(response_data, f)
        except Exception as cache_err:
            print(f"Warning: Failed to write cache: {cache_err}")
        
        return response_data
    except Exception as e:
        print(f"CRITICAL: Error getting latest repos: {e}")
        return {"projects": [], "error": str(e)}

@router.get("/profile/{username}")
def get_profile(
    username: str,
    db: Session = Depends(get_db)
):
    # Run consistency check with cooldown
    run_consistency_check_if_needed(db)

    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        projects = db.query(Project).filter(Project.user_id == user.id).all()
        
        project_list = []
        for project in projects:
            project_list.append({
                "project_name": project.project_name,
                "created_at": project.created_at.isoformat(),
                "last_updated": project.last_updated.isoformat()
            })
        
        # Generate Gravatar URL
        email_hash = hashlib.md5(user.email.lower().strip().encode('utf-8')).hexdigest()
        gravatar_url = f"https://www.gravatar.com/avatar/{email_hash}?d=identicon&s=200"
        
        return {
            "username": user.username,
            "email": user.email,
            "gravatar_url": gravatar_url,
            "joined_at": user.created_at.isoformat(),
            "projects": project_list
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")
