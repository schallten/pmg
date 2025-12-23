import os
import time
from sqlalchemy.orm import Session
from .models import Project, FileRecord, Commit, User

LAST_CHECK_FILE = "temp/last_consistency_check.txt"
CHECK_COOLDOWN = 600  # 10 minutes

def run_consistency_check_if_needed(db: Session):
    """
    Runs the consistency check only if the cooldown period has passed.
    """
    now = time.time()
    should_check = True
    if os.path.exists(LAST_CHECK_FILE):
        try:
            with open(LAST_CHECK_FILE, "r") as f:
                last_check = float(f.read().strip())
            if now - last_check < CHECK_COOLDOWN:
                should_check = False
        except:
            pass
            
    if should_check:
        verify_and_cleanup_db(db)
        try:
            os.makedirs("temp", exist_ok=True)
            with open(LAST_CHECK_FILE, "w") as f:
                f.write(str(now))
        except:
            pass

def verify_and_cleanup_db(db: Session):
    """
    Checks if files and projects in the database actually exist on disk.
    If not, cleans up the database records to maintain consistency.
    """
    print("Running database-to-filesystem consistency check...")
    
    # 1. Check Projects
    projects = db.query(Project).all()
    for project in projects:
        owner = db.query(User).filter(User.id == project.user_id).first()
        if not owner:
            # Orphaned project, should probably be removed
            print(f"Removing orphaned project: {project.project_name} (No owner)")
            db.delete(project)
            continue
            
        project_dir = os.path.join("storage", "files", owner.username, project.project_name)
        if not os.path.exists(project_dir):
            print(f"Project directory missing for {owner.username}/{project.project_name}. Cleaning up DB records.")

            db.query(FileRecord).filter(FileRecord.commit_id.in_(
                db.query(Commit.commit_id).filter(Commit.project_id == project.id)
            )).delete(synchronize_session=False)
            db.query(Commit).filter(Commit.project_id == project.id).delete()
            db.delete(project)
            continue

        file_records = db.query(FileRecord).filter(FileRecord.commit_id.in_(
            db.query(Commit.commit_id).filter(Commit.project_id == project.id)
        )).all()
        
        for record in file_records:
            if not os.path.exists(record.storage_path):
                print(f"File missing on disk: {record.storage_path}. Removing DB record.")
                db.delete(record)

    db.commit()
    print("Consistency check completed.")
