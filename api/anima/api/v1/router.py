from fastapi import APIRouter
from anima.api.v1 import users, chat, questions, knowledge

router = APIRouter(prefix="/api/v1")
router.include_router(users.router)
router.include_router(chat.router)
router.include_router(questions.router)
router.include_router(knowledge.router)
