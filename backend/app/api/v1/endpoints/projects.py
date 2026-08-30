from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.domain import Project, User
from backend.app.schemas.domain import ProjectCreate, ProjectOut

router = APIRouter()

@router.get("/", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    if not projects:
        # Seed default project if empty
        user = db.query(User).first()
        owner_id = user.id if user else "demo-user-id"
        demo_proj = Project(
            title="Mumbai Coastal & Maritime Surveillance",
            description="Sentinel-1 SAR & Sentinel-2 optical surveillance project over Mumbai harbor.",
            owner_id=owner_id,
            location_name="Mumbai Port",
            centre_lat=18.9438,
            centre_lng=72.8360,
            zoom_level=13
        )
        db.add(demo_proj)
        db.commit()
        db.refresh(demo_proj)
        projects = [demo_proj]
    return projects

@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(proj_in: ProjectCreate, db: Session = Depends(get_db)):
    user = db.query(User).first()
    owner_id = user.id if user else "demo-user-id"
    
    project = Project(
        title=proj_in.title,
        description=proj_in.description,
        owner_id=owner_id,
        location_name=proj_in.location_name,
        centre_lat=proj_in.centre_lat,
        centre_lng=proj_in.centre_lng,
        zoom_level=proj_in.zoom_level,
        aoi_geojson=proj_in.aoi_geojson
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None
