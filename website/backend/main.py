from fastapi import FastAPI, Depends, HTTPException, Header, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import shutil
import zipfile
import os
from dotenv import load_dotenv
from datetime import datetime
from contextlib import contextmanager
from typing import Generator, Optional
import hashlib
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session, Mapped, mapped_column

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create Base for models needed because SQLAlchemy ORM uses it to map classes to database tables to make it easier to work with relational data in an object-oriented way different from the traditional way of writing raw SQL queries that is more error-prone and less maintainable.
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    api_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    projects = relationship("Project", back_populates="user")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_name = Column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="projects")
    commits = relationship("Commit", back_populates="project")
    
    __table_args__ = (UniqueConstraint('user_id', 'project_name', name='unique_user_project'),)


class Commit(Base):
    __tablename__ = "commits"
    
    id = Column(Integer, primary_key=True, index=True)
    commit_id = Column(String(36), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    commit_message = Column(String(50), nullable=False)
    author = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="commits")
    files = relationship("FileRecord", back_populates="commit")


class FileRecord(Base):
    __tablename__ = "file_records"
    
    id = Column(Integer, primary_key=True, index=True)
    commit_id = Column(String(36), ForeignKey("commits.commit_id"), nullable=False)
    path = Column(Text, nullable=False)
    hash = Column(String(64), nullable=False, index=True)
    last_updated = Column(Integer, nullable=False)
    storage_path = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    commit = relationship("Commit", back_populates="files")


# Create engine with psycopg2
engine = create_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
)

# Create session maker
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# Database initialization function
def init_db() -> None:
    """Initialize database and create all tables"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")


# Create FastAPI app
app = FastAPI()

# CORS middleware
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event
@app.on_event("startup")
def startup_event() -> None:
    print("Starting up...")
    init_db()


# Shutdown event
@app.on_event("shutdown")
def shutdown_event() -> None:
    print("Shutting down...")
    engine.dispose()


# Dependency to get database session
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Dependency to authenticate user
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "").strip()
    user = db.query(User).filter(User.api_key == token).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return user


# Routes
@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Hey, you have accessed the root endpoint of PMG, which unfortunately does nothing. Would recommend you check the docs. Have a great day/night :D"
    }


@app.get("/api/authenticate")
def authorization(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {
        "message": "User authenticated successfully",
        "username": user.username
    }

@app.post("/api/signup")
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


@app.post("/api/login")
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


@app.post("/api/push/file")
async def push_file(
    commit_id: str = Form(...),
    project_name: str = Form(...),
    path: str = Form(...),
    hash: str = Form(...),
    last_updated: int = Form(...),
    commit_message: str = Form(...),
    author: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict[str, str]:
    try:
        # Read and verify file
        file_content = await file.read()
        calculated_hash = hashlib.sha256(file_content).hexdigest()
        
        if calculated_hash != hash:
            raise HTTPException(status_code=400, detail="File hash mismatch - file may be corrupted")
        
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
        
        os.makedirs(os.path.dirname(file_path_full), exist_ok=True)
        
        # Backup existing file if it exists
        if os.path.exists(file_path_full):
            history_dir = os.path.join(project_storage, ".history", commit_id)
            os.makedirs(history_dir, exist_ok=True)
            
            backup_path = os.path.join(history_dir, path)
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            
            # Move old file to history
            shutil.copy2(file_path_full, backup_path)
        
        # Save new file
        with open(file_path_full, "wb") as f:
            f.write(file_content)
        
        # Create file record
        file_record = FileRecord(
            commit_id=commit_id,
            path=path,
            hash=hash,
            last_updated=last_updated,
            storage_path=file_path_full,
            file_size=len(file_content)
        )
        db.add(file_record)
        
        # Update project timestamp
        project.last_updated = datetime.utcnow()
        db.commit()
        
        return {
            "success": "true",
            "message": "File uploaded successfully",
            "file_path": path,
            "hash": hash
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    

@app.post("/api/pull/{username}/{project_name}")
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

        return FileResponse(
            path=zip_filepath,
            filename = zip_filename,
            media_type='application/zip',
            background=BackgroundTasks(lambda: os.remove(zip_filepath))
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error pulling project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to pull project: {str(e)}")

@app.post("/api/fetch/{username}/{project_name}")
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