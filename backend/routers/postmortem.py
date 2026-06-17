from fastapi import APIRouter
from backend.services.postmortem_generator import generate_postmortem

router = APIRouter()


@router.post("/{incident_id}")
async def create_postmortem(incident_id: str):
    result = generate_postmortem(incident_id)
    return result
