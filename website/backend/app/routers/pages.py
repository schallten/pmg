from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
from ..database import get_db
from ..models import User, Project, RepoDetails

router = APIRouter(prefix="/pages")

@router.get("/{username}/{project_name}/{file_path:path}")
async def serve_page(
    username: str,
    project_name: str,
    file_path: str,
    db: Session = Depends(get_db)
):
    # Verify project exists and is deployed
    project_owner = db.query(User).filter(User.username == username).first()
    if not project_owner:
        raise HTTPException(status_code=404, detail="User not found")
    
    project = db.query(Project).filter(
        Project.user_id == project_owner.id,
        Project.project_name == project_name
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    repo_details = db.query(RepoDetails).filter(RepoDetails.project_id == project.id).first()
    
    if not repo_details or not repo_details.isDeployed:
        raise HTTPException(status_code=404, detail="Project is not deployed")
    
    # Construct file path
    # If file_path is empty or ends with /, append the source path (e.g. index.html)
    # However, the route definition {file_path:path} might capture empty string as well if we use a different setup, 
    # but usually it requires at least a slash.
    # Let's assume the frontend redirects to .../index.html or the user links to it.
    # Actually, for a "site", we often want root to serve index.html.
    
    base_path = os.path.join("storage", "files", username, project_name)
    full_path = os.path.join(base_path, file_path)
    
    # Security check to prevent directory traversal
    if not os.path.abspath(full_path).startswith(os.path.abspath(base_path)):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if os.path.isdir(full_path):
        # Try to serve index.html if it's a directory
        full_path = os.path.join(full_path, "index.html")
        
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(full_path)

@router.get("/{username}/{project_name}")
async def serve_root(
    username: str,
    project_name: str,
    db: Session = Depends(get_db)
):
    # Redirect to the source path configured for the project
    project_owner = db.query(User).filter(User.username == username).first()
    if not project_owner:
        raise HTTPException(status_code=404, detail="User not found")
    
    project = db.query(Project).filter(
        Project.user_id == project_owner.id,
        Project.project_name == project_name
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    repo_details = db.query(RepoDetails).filter(RepoDetails.project_id == project.id).first()
    
    if not repo_details or not repo_details.isDeployed:
        raise HTTPException(status_code=404, detail="Project is not deployed")
        
    source_path = repo_details.deploy_source_path or "index.html"
    
    base_path = os.path.join("storage", "files", username, project_name)
    full_path = os.path.join(base_path, source_path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Source file '{source_path}' not found")
        
    return FileResponse(full_path)
