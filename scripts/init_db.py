import os
import sys

# Ensure workspace root is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db.session import engine, SessionLocal, Base
from backend.app.models.domain import User, Project, DatasetSample
from backend.app.core.security import get_password_hash
from backend.app.ml.bigearthnet_loader import bigearthnet_manager

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Seed Lead User
        user = db.query(User).filter(User.email == "lochan@satquery.ai").first()
        if not user:
            print("Seeding MLOps Lead User...")
            user = User(
                email="lochan@satquery.ai",
                username="lochan_mlops",
                hashed_password=get_password_hash("satquery2026"),
                full_name="Lochan (Backend & MLOps Lead)",
                is_superuser=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 2. Seed Default Project
        project = db.query(Project).first()
        if not project:
            print("Seeding Default Satellite Project...")
            project = Project(
                title="ISRO SpaceTech - Sentinel Coastal Analysis",
                description="Multimodal Sentinel-1 SAR & Sentinel-2 optical monitoring project for SIH 2026.",
                owner_id=user.id,
                location_name="Visakhapatnam Port & Coast",
                centre_lat=17.6868,
                centre_lng=83.2185,
                zoom_level=13
            )
            db.add(project)
            db.commit()

        # 3. Seed BigEarthNet Dataset Samples
        # (No VRSBench row: SatQuery doesn't evaluate against VRSBench, so
        # there's no real sample data for it -- see ml/vrsbench_eval.py.)
        existing_samples = db.query(DatasetSample).count()
        if existing_samples == 0:
            print("Seeding BigEarthNet Dataset Samples...")
            ben_samples = bigearthnet_manager.get_sample_patches()
            for s in ben_samples:
                ds = DatasetSample(
                    dataset_name="BigEarthNet",
                    sample_key=s["sample_key"],
                    sentinel_1_polarizations=s["sentinel_1_polarizations"],
                    sentinel_2_bands=s["sentinel_2_bands"],
                    corine_classes=s["corine_classes"],
                    spatial_coords=s["spatial_coords"]
                )
                db.add(ds)
            db.commit()

        print("Database initialization and seed complete!")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
