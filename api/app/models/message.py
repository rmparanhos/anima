import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String, ForeignKey("conversations.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    # audit fields
    rag_chunks_used: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of chunk IDs
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    triggered_question_id: Mapped[str | None] = mapped_column(String, nullable=True)  # references questions.id, no FK to avoid circular dep

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
