from fastapi import APIRouter
from backend.app.api.v1.endpoints import auth, query, projects, analysis, datasets, models, ai

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(query.router, prefix="/query", tags=["Vision-Language Query"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Assistant"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects & AOI"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["Satellite Analysis"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets & MLOps"])
api_router.include_router(models.router, prefix="/models", tags=["Model Serving"])
