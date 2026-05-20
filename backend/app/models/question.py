import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, Integer, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    asked_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    original_message_id: Mapped[str | None] = mapped_column(String, ForeignKey("messages.id"), nullable=True)
    normalized_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending | answered | rejected
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    knowledge_chunk_id: Mapped[str | None] = mapped_column(String, ForeignKey("knowledge_chunks.id"), nullable=True)
    votes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    asker: Mapped["User"] = relationship(foreign_keys=[asked_by], back_populates="questions_asked")
    answerer: Mapped["User | None"] = relationship(foreign_keys=[answered_by], back_populates="questions_answered")
    duplicates_as_canonical: Mapped[list["QuestionDuplicate"]] = relationship(foreign_keys="QuestionDuplicate.canonical_id", back_populates="canonical")
    duplicates_as_duplicate: Mapped[list["QuestionDuplicate"]] = relationship(foreign_keys="QuestionDuplicate.duplicate_id", back_populates="duplicate")


class QuestionDuplicate(Base):
    __tablename__ = "question_duplicates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    canonical_id: Mapped[str] = mapped_column(String, ForeignKey("questions.id"), nullable=False)
    duplicate_id: Mapped[str] = mapped_column(String, ForeignKey("questions.id"), nullable=False)
    similarity: Mapped[float] = mapped_column(Float, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    canonical: Mapped["Question"] = relationship(foreign_keys=[canonical_id], back_populates="duplicates_as_canonical")
    duplicate: Mapped["Question"] = relationship(foreign_keys=[duplicate_id], back_populates="duplicates_as_duplicate")
