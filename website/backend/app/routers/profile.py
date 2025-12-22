from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Project

router = APIRouter(prefix="/api")

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

@router.get("/profile/{username}")
def get_profile(
    username: str,
    db: Session = Depends(get_db)
):
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
        
        return {
            "username": user.username,
            "joined_at": user.created_at.isoformat(),
            "projects": project_list
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")
