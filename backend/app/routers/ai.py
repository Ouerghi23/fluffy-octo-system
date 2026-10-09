import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.ai.assistant import ask
from app.database import get_db

router = APIRouter(prefix="/ai", tags=["Assistant IA"])
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str]


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    # On garde les 20 derniers messages, en commençant toujours par un message utilisateur
    history = [m.model_dump() for m in req.messages[-20:]]
    while history and history[0]["role"] != "user":
        history.pop(0)

    try:
        return ask(db, history)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Erreur de l'assistant IA")
        if getattr(e, "code", None) == 429:
            raise HTTPException(status_code=429, detail="Quota Gemini atteint. Réessayez dans une minute.")
        raise HTTPException(
            status_code=502,
            detail="L'assistant IA est momentanément indisponible. Réessayez dans un instant.",
        )