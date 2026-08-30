import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="active")  # active, archived, completed
    location_name = Column(String, nullable=True)
    centre_lat = Column(Float, nullable=True)
    centre_lng = Column(Float, nullable=True)
    zoom_level = Column(Integer, default=12)
    aoi_geojson = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="projects")
    chat_sessions = relationship("ChatSession", back_populates="project")
    satellite_images = relationship("SatelliteImage", back_populates="project")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, default="New Satellite Query Session")
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="chat_sessions")
    project = relationship("Project", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    sender = Column(String, nullable=False)  # user, assistant
    text = Column(Text, nullable=False)
    intent_type = Column(String, nullable=True)
    intent_confidence = Column(Float, nullable=True)
    attachments = Column(JSON, nullable=True)
    suggested_actions = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")

class SatelliteImage(Base):
    __tablename__ = "satellite_images"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    satellite = Column(String, nullable=False)  # Sentinel-1 SAR, Sentinel-2 Multispectral
    sensor_type = Column(String, nullable=False)  # SAR, Optical, Multispectral
    acquisition_date = Column(DateTime, nullable=False)
    bbox = Column(JSON, nullable=True)  # [min_lng, min_lat, max_lng, max_lat]
    bands = Column(JSON, nullable=True)  # ["VV", "VH"] or ["B2", "B3", "B4", "B8", "B11", "B12"]
    cloud_cover_percent = Column(Float, default=0.0)
    resolution_m = Column(Float, default=10.0)
    tile_url = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="satellite_images")

class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String, primary_key=True, default=generate_uuid)
    job_type = Column(String, nullable=False)  # detection, change_detection, land_cover, measurement
    status = Column(String, default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    location = Column(String, nullable=True)
    aoi_bounds = Column(JSON, nullable=True)
    parameters = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    results = relationship("AnalysisResult", back_populates="job", cascade="all, delete-orphan")

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("analysis_jobs.id"), nullable=False)
    kind = Column(String, nullable=False)  # detection, change, land_cover, measurement
    confidence = Column(Float, default=0.95)
    summary_text = Column(Text, nullable=True)
    data_payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    job = relationship("AnalysisJob", back_populates="results")

class DatasetSample(Base):
    __tablename__ = "dataset_samples"

    id = Column(String, primary_key=True, default=generate_uuid)
    dataset_name = Column(String, nullable=False)  # BigEarthNet, VRSBench
    sample_key = Column(String, nullable=False, index=True)
    sentinel_1_polarizations = Column(JSON, nullable=True)  # ["VV", "VH"]
    sentinel_2_bands = Column(JSON, nullable=True)  # 12 bands
    corine_classes = Column(JSON, nullable=True)  # multi-label land cover annotations
    vrsbench_qa_pairs = Column(JSON, nullable=True)  # [{question, answer, task_type}]
    spatial_coords = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class VectorEmbedding(Base):
    __tablename__ = "vector_embeddings"

    id = Column(String, primary_key=True, default=generate_uuid)
    entity_type = Column(String, nullable=False)  # query, image_patch, land_cover_concept
    entity_id = Column(String, nullable=False)
    text_content = Column(Text, nullable=True)
    embedding_dim = Column(Integer, default=512)
    embedding_vector = Column(JSON, nullable=False)  # list of floats
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
