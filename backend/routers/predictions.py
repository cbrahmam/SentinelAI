from fastapi import APIRouter
from backend.services.predictor import get_all_predictions, get_predictions_for_service

router = APIRouter()


@router.get("")
async def list_predictions():
    predictions = get_all_predictions()
    return {"predictions": predictions, "count": len(predictions)}


@router.get("/{service}")
async def service_predictions(service: str):
    predictions = get_predictions_for_service(service)
    return {"service": service, "predictions": predictions, "count": len(predictions)}
