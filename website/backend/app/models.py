from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from .database import Base

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


class RepoDetails(Base):
    __tablename__ = "repo_details"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    isDeployed: Mapped[bool] = mapped_column(Boolean, default=False)
    deploy_source_path: Mapped[str] = mapped_column(String(255), nullable=True)
    downloadCount: Mapped[int] = mapped_column(Integer, default=0)
    visits: Mapped[int] = mapped_column(Integer, default=0)


class Star(Base):
    __tablename__ = "stars"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint('user_id', 'project_id', name='unique_user_project_star'),)
