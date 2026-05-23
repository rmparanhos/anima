from pydantic import BaseModel
from datetime import datetime


class UserCreate(BaseModel):
    handle: str


class UserOut(BaseModel):
    id: str
    handle: str
    created_at: datetime

    model_config = {"from_attributes": True}
