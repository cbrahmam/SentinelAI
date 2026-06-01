from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.ai_chat import ask_ai

router = APIRouter()


class AskRequest(BaseModel):
    question: str


@router.post("")
async def api_ask(req: AskRequest):
    result = ask_ai(req.question)
    return result
