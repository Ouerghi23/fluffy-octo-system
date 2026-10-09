from datetime import date as dt_date
from pydantic import BaseModel, ConfigDict, Field


# ---------- Vaches ----------
class CowBase(BaseModel):
    ear_tag: str
    name: str | None = None
    breed: str
    birth_date: dt_date
    weight: float | None = None
    status: str = "active"
    lactation_number: int = 0


class CowCreate(CowBase):
    pass


class CowUpdate(BaseModel):
    ear_tag: str | None = None
    name: str | None = None
    breed: str | None = None
    birth_date: dt_date | None = None
    weight: float | None = None
    status: str | None = None
    lactation_number: int | None = None


class CowOut(CowBase):
    id: int
    photo_url: str | None = None
    model_config = ConfigDict(from_attributes=True)


# ---------- Production de lait ----------
class MilkCreate(BaseModel):
    cow_id: int
    date: dt_date
    quantity_liters: float = Field(gt=0, lt=100)


class MilkOut(MilkCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)