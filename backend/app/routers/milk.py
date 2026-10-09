from multiprocessing.reduction import duplicate

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/milk", tags=["Production de lait"])


@router.post("/", response_model=schemas.MilkOut, status_code=201)
def add_milk_record(data: schemas.MilkCreate, db: Session = Depends(get_db)):
    if not db.get(models.Cow, data.cow_id):
        raise HTTPException(status_code=404, detail="Vache introuvable")
        duplicate = db.scalar(
        select(models.MilkProduction).where(
            models.MilkProduction.cow_id == data.cow_id,
            models.MilkProduction.date == data.date,
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="Une production est déjà enregistrée pour cette vache à cette date",
        )
    record = models.MilkProduction(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record



@router.get("/", response_model=list[schemas.MilkOut])
def list_milk_records(cow_id: int | None = None, db: Session = Depends(get_db)):
    query = select(models.MilkProduction).order_by(models.MilkProduction.date.desc())
    if cow_id:
        query = query.where(models.MilkProduction.cow_id == cow_id)
    return db.scalars(query).all()