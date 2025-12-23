from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile, Header, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
import shutil
import hashlib
import zipfile
import base64
from datetime import datetime

from ..database import get_db
from ..models import User, Project, Commit, FileRecord, RepoDetails, Star
from ..dependencies import get_current_user

router = APIRouter(prefix="/api")

@router.post("/push/file")
async def push_file(
    commit_id: str = Form(...),
    project_name: str = Form(...),
    path: str = Form(...),
    hash: str = Form(...),
    last_updated: int = Form(...),
    commit_message: str = Form(...),
    author: str = Form(...),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict[str, str]:
    try:
        # Get or create project
        project = db.query(Project).filter(
            Project.user_id == user.id,
            Project.project_name == project_name
        ).first()
        
        if not project:
            project = Project(user_id=user.id, project_name=project_name)
            db.add(project)
            db.flush()
        
        # Get or create commit
        commit = db.query(Commit).filter(Commit.commit_id == commit_id).first()
        
        if not commit:
            commit = Commit(
                commit_id=commit_id,
                project_id=project.id,
                commit_message=commit_message,
                author=author
            )
            db.add(commit)
            db.flush()
        
        # Define storage paths
        username = user.username  # Assuming User model has username field
        project_storage = os.path.join("storage", "files", username, project_name)
        file_path_full = os.path.join(project_storage, path)
        
        if hash == "DELETED":
            # Handle deletion
            if os.path.exists(file_path_full):
                history_dir = os.path.join(project_storage, ".history", commit_id)
                os.makedirs(history_dir, exist_ok=True)
                
                backup_path = os.path.join(history_dir, path)
                os.makedirs(os.path.dirname(backup_path), exist_ok=True)
                
                # Move old file to history (effectively deleting it from current view)
                shutil.move(file_path_full, backup_path)
            
            file_size = 0
            
        else:
            if not file:
                raise HTTPException(status_code=400, detail="File content required for non-deleted files")

            # Read and verify file
            file_content = await file.read()
            calculated_hash = hashlib.sha256(file_content).hexdigest()
            
            # Use the calculated hash of the uploaded content
            # This ensures the database reflects the actual content stored,
            # even if the file changed between commit and push.
            hash = calculated_hash
            
            os.makedirs(os.path.dirname(file_path_full), exist_ok=True)
            
            # Backup existing file if it exists
            if os.path.exists(file_path_full):
                history_dir = os.path.join(project_storage, ".history", commit_id)
                os.makedirs(history_dir, exist_ok=True)
                
                backup_path = os.path.join(history_dir, path)
                os.makedirs(os.path.dirname(backup_path), exist_ok=True)
                
                # Copy old file to history
                shutil.copy2(file_path_full, backup_path)
            
            # Save new file
            with open(file_path_full, "wb") as f:
                f.write(file_content)
            
            file_size = len(file_content)
        
        # Create file record
        file_record = FileRecord(
            commit_id=commit_id,
            path=path,
            hash=hash,
            last_updated=last_updated,
            storage_path=file_path_full,
            file_size=file_size
        )
        db.add(file_record)
        
        # Update project timestamp
        project.last_updated = datetime.utcnow()
        db.commit()
        
        return {
            "success": "true",
            "message": "File processed successfully",
            "file_path": path,
            "hash": hash
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    

@router.post("/pull/{username}/{project_name}")
def pull_project(
    username: str,
    project_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        project_owner = db.query(User).filter(User.username == username).first()

        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_dir = os.path.join("storage", "files", username, project_name)

        if not os.path.exists(project_dir):
            raise HTTPException(status_code=404, detail="Project files not found on server")
        
        # creating temporary zip file
        zip_filename = f"{project_name}.zip"
        zip_filepath = os.path.join("temp", zip_filename)
        os.makedirs("temp", exist_ok=True)

        # we create zip file ignoring  the .history folder
        with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root,dirs,files in os.walk(project_dir):
                if '.history' in root.split(os.sep):
                    continue

                if '.history' in dirs:
                    dirs.remove('.history')

                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, project_dir)
                    zipf.write(file_path, arcname)

        bg_tasks = BackgroundTasks()
        bg_tasks.add_task(os.remove, zip_filepath)

        return FileResponse(
            path=zip_filepath,
            filename = zip_filename,
            media_type='application/zip',
            background=bg_tasks
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error pulling project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to pull project: {str(e)}")

@router.api_route("/fetch/{username}/{project_name}", methods=["GET", "POST"])
def fetch_latest_commit(
    username: str,
    project_name: str,
    db: Session = Depends(get_db)
):
    try:
        project_owner = db.query(User).filter(User.username == username).first()
        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        latest_commit = db.query(Commit).filter(
            Commit.project_id == project.id
        ).order_by(Commit.created_at.desc()).first()
        
        if not latest_commit:
            return {
                "message": "No commits found for this project"
            }
        
        return {
            "latest_commit_id": latest_commit.commit_id,
            "timestamp": latest_commit.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching latest commit: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch latest commit: {str(e)}")

@router.get("/repo/{username}/{project_name}")
def get_repository(
    username: str,
    project_name: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    try:
        project_owner = db.query(User).filter(User.username == username).first()

        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # we will only show latest commit by default
        latest_commit = db.query(Commit).filter(
            Commit.project_id == project.id
        ).order_by(Commit.created_at.desc()).first()

        # getting the project directory
        project_dir = os.path.join("storage", "files", username, project_name)

        if not os.path.exists(project_dir):
            raise HTTPException(status_code=404, detail="Project files not found on server")
        
        files = []
        for root, dirs, file_names in os.walk(project_dir):
            if '.history' in root.split(os.sep):
                continue

            if '.history' in dirs:
                dirs.remove('.history')

            for filename in file_names:
                file_path = os.path.join(root, filename)
                relative_path = os.path.relpath(file_path, project_dir).replace(os.sep, '/')
                files.append({
                    "path": relative_path,
                    "size": os.path.getsize(file_path)
                })

        readme_content = None
        for readme_name in ["README.md", "readme.md", "Readme.md"]:
            readme_path = os.path.join(project_dir, readme_name)
            if os.path.exists(readme_path):
                with open(readme_path, "r", encoding="utf-8") as f:
                    readme_content = f.read()
                break
        
        # Get star count
        repo_details = db.query(RepoDetails).filter(RepoDetails.project_id == project.id).first()
        star_count = repo_details.stars if repo_details else 0
        
        # Check if current user has starred
        is_starred = False
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "").strip()
            current_user = db.query(User).filter(User.api_key == token).first()
            if current_user:
                star_exists = db.query(Star).filter(
                    Star.user_id == current_user.id,
                    Star.project_id == project.id
                ).first()
                if star_exists:
                    is_starred = True

        return {
            "username": username,
            "project_name": project_name,
            "created_at": project.created_at.isoformat(),
            "last_updated": project.last_updated.isoformat(),
            "latest_commit": {
                "id": latest_commit.commit_id,
                "message": latest_commit.commit_message,
                "author": latest_commit.author,
                "date": latest_commit.created_at.isoformat()
            } if latest_commit else None,
            "files": files,
            "readme": readme_content,
            "stars": star_count,
            "is_starred": is_starred,
            "isDeployed": repo_details.isDeployed if repo_details else False,
            "deploy_source_path": repo_details.deploy_source_path if repo_details else None,
            "deployment_url": f"/pages/{username}/{project_name}" if repo_details and repo_details.isDeployed else None
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting repository info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get repository info: {str(e)}")
    
@router.get("/repo/{username}/{project_name}/file/{file_path:path}")
def get_file(
    username: str,
    project_name : str,
    file_path: str
):
    try:
        full_path = os.path.join("storage","files",username,project_name,file_path)

        if not os.path.exists(full_path):
            raise HTTPException(status_code=404,detail="File not found")
        
        try:
            with open(full_path,"r",encoding="utf-8") as f:
                content = f.read()
            return {
                "path": file_path,
                "content": content,
                "type": "text"
            }
        except:
            with open(full_path,"rb") as f:
                return {
                    "path": file_path,
                    "content": base64.b64encode(f.read()).decode('utf-8'),
                    "type": "binary"
                }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get file: {str(e)}")
    
@router.get("/repo/{username}/{project_name}/commits")
def list_commits(
    username: str,
    project_name: str,
    db: Session = Depends(get_db)
):
    try:
        project_owner = db.query(User).filter(User.username == username).first()

        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        commits = db.query(Commit).filter(
            Commit.project_id == project.id
        ).order_by(Commit.created_at.desc()).all()
        
        commit_list = []
        for commit in commits:
            commit_list.append({
                "id": commit.commit_id,
                "message": commit.commit_message,
                "author": commit.author,
                "date": commit.created_at.isoformat()
            })
        
        return {
            "project_name": project_name,
            "commits": commit_list
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing commits: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list commits: {str(e)}")
    
@router.get("/repo/{username}/{project_name}/languages")
def get_languages_list(
    username: str,
    project_name: str,
    db: Session = Depends(get_db)
):
    # return a list of how much percentage of each programming language is used in the project
    try:
        project_owner = db.query(User).filter(User.username == username).first()

        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_dir = os.path.join("storage", "files", username, project_name)

        if not os.path.exists(project_dir):
            raise HTTPException(status_code=404, detail="Project files not found on server")
        
        language_extensions = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.cs': 'C#',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.php': 'PHP',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.m': 'Objective-C',
        }
        
        language_stats = {}
        total_size = 0
        
        for root, dirs, files in os.walk(project_dir):
            if '.history' in root.split(os.sep):
                continue

            if '.history' in dirs:
                dirs.remove('.history')

            for filename in files:
                file_path = os.path.join(root, filename)
                ext = os.path.splitext(filename)[1]
                size = os.path.getsize(file_path)
                
                if ext in language_extensions:
                    lang = language_extensions[ext]
                    language_stats[lang] = language_stats.get(lang, 0) + size
                    total_size += size
        
        # Calculate percentages
        for lang in language_stats:
            language_stats[lang] = round((language_stats[lang] / total_size) * 100, 2) if total_size > 0 else 0.0
        
        return {
            "project_name": project_name,
            "languages": language_stats
        }
       # expected output : {"project_name": "my_project", "languages": {"Python": 50.0, "JavaScript": 30.0, "TypeScript": 20.0}}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting language stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get language stats: {str(e)}")

@router.post("/star_repo/{username}/{project_name}")
def star_repository(
    username: str,
    project_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        project_owner = db.query(User).filter(User.username == username).first()

        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if already starred
        existing_star = db.query(Star).filter(
            Star.user_id == user.id,
            Star.project_id == project.id
        ).first()
        
        repo_details = db.query(RepoDetails).filter(RepoDetails.project_id == project.id).first()
        if not repo_details:
            repo_details = RepoDetails(project_id=project.id, stars=0)
            db.add(repo_details)
            db.flush() # flush to get ID if needed, though we have project_id

        is_starred = False
        if existing_star:
            # Unstar
            db.delete(existing_star)
            repo_details.stars = max(0, repo_details.stars - 1)
            message = "Repository unstarred successfully"
            is_starred = False
        else:
            # Star
            new_star = Star(user_id=user.id, project_id=project.id)
            db.add(new_star)
            repo_details.stars += 1
            message = "Repository starred successfully"
            is_starred = True
        
        db.commit()
        
        return {
            "message": message,
            "total_stars": repo_details.stars,
            "is_starred": is_starred
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error starring repository: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to star repository: {str(e)}")

@router.post("/deploy/{username}/{project_name}")
def deploy_project(
    username: str,
    project_name: str,
    source_path: str = Form("index.html"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Verify ownership
        if user.username != username:
            raise HTTPException(status_code=403, detail="Only the project owner can deploy")
            
        project = db.query(Project).filter(
            Project.user_id == user.id,
            Project.project_name == project_name
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        repo_details = db.query(RepoDetails).filter(RepoDetails.project_id == project.id).first()
        
        if not repo_details:
            repo_details = RepoDetails(project_id=project.id)
            db.add(repo_details)
            
        # Verify source file exists
        project_dir = os.path.join("storage", "files", username, project_name)
        full_source_path = os.path.join(project_dir, source_path)
        
        if not os.path.exists(full_source_path):
            raise HTTPException(status_code=400, detail=f"Source file '{source_path}' does not exist")
            
        repo_details.isDeployed = True
        repo_details.deploy_source_path = source_path
        db.commit()
        
        return {
            "message": "Project deployed successfully",
            "deployment_url": f"/pages/{username}/{project_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deploying project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to deploy project: {str(e)}")

@router.post("/undeploy/{username}/{project_name}")
def undeploy_project(
    username: str,
    project_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Verify ownership
        if user.username != username:
            raise HTTPException(status_code=403, detail="Only the project owner can undeploy")
            
        project = db.query(Project).filter(
            Project.user_id == user.id,
            Project.project_name == project_name
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        repo_details = db.query(RepoDetails).filter(RepoDetails.project_id == project.id).first()
        
        if repo_details:
            repo_details.isDeployed = False
            db.commit()
            
        return {
            "message": "Project undeployed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error undeploying project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to undeploy project: {str(e)}")

@router.post("/fork/{username}/{project_name}")
def fork_repository(
    username: str,
    project_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        project_owner = db.query(User).filter(User.username == username).first()

        if not project_owner:
            raise HTTPException(status_code=404, detail="Project owner not found")
        
        original_project = db.query(Project).filter(
            Project.user_id == project_owner.id,
            Project.project_name == project_name
        ).first()

        if not original_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create new project for the forking user
        forked_project_name = f"{project_name}-fork"
        existing_fork = db.query(Project).filter(
            Project.user_id == user.id,
            Project.project_name == forked_project_name
        ).first()
        
        if existing_fork:
            raise HTTPException(status_code=400, detail="You have already forked this repository")
        
        forked_project = Project(
            user_id=user.id,
            project_name=forked_project_name
        )
        db.add(forked_project)
        db.flush()
        
        # Copy files in storage
        original_dir = os.path.join("storage", "files", username, project_name)
        forked_dir = os.path.join("storage", "files", user.username, forked_project_name)
        shutil.copytree(original_dir, forked_dir)
        
        db.commit()
        
        return {
            "message": "Repository forked successfully",
            "forked_project_name": forked_project_name
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error forking repository: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fork repository: {str(e)}")
    
@router.delete("/delete_repo/{username}/{project_name}")
def delete_repository(
    username: str,
    project_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Verify ownership
        if user.username != username:
            raise HTTPException(status_code=403, detail="Only the project owner can delete the repository")
            
        project = db.query(Project).filter(
            Project.user_id == user.id,
            Project.project_name == project_name
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete project files
        project_dir = os.path.join("storage", "files", username, project_name)
        if os.path.exists(project_dir):
            shutil.rmtree(project_dir)
        
        # Delete database records
        db.query(Star).filter(Star.project_id == project.id).delete()
        db.query(RepoDetails).filter(RepoDetails.project_id == project.id).delete()
        db.query(FileRecord).filter(FileRecord.commit_id.in_(
            db.query(Commit.commit_id).filter(Commit.project_id == project.id)
        )).delete(synchronize_session=False)
        db.query(Commit).filter(Commit.project_id == project.id).delete()
        db.delete(project)
        
        db.commit()
        
        return {
            "message": "Repository deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting repository: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete repository: {str(e)}")