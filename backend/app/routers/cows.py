import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.storage import COW_PHOTOS_DIR

router = APIRouter(prefix="/cows", tags=["Vaches"])

ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 Mo


def get_cow_or_404(db: Session, cow_id: int) -> models.Cow:
    cow = db.get(models.Cow, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail="Vache introuvable")
    return cow


def remove_photo_file(photo_url: str | None):
    if photo_url:
        (COW_PHOTOS_DIR / Path(photo_url).name).unlink(missing_ok=True)


# ---------- CRUD ----------
@router.get("/", response_model=list[schemas.CowOut])
def list_cows(db: Session = Depends(get_db)):
    return db.scalars(select(models.Cow).order_by(models.Cow.ear_tag)).all()


@router.get("/{cow_id}", response_model=schemas.CowOut)
def get_cow(cow_id: int, db: Session = Depends(get_db)):
    return get_cow_or_404(db, cow_id)


@router.post("/", response_model=schemas.CowOut, status_code=201)
def create_cow(data: schemas.CowCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Cow).where(models.Cow.ear_tag == data.ear_tag)):
        raise HTTPException(status_code=400, detail="Ce numéro de boucle existe déjà")
    cow = models.Cow(**data.model_dump())
    db.add(cow)
    db.commit()
    db.refresh(cow)
    return cow


@router.put("/{cow_id}", response_model=schemas.CowOut)
def update_cow(cow_id: int, data: schemas.CowUpdate, db: Session = Depends(get_db)):
    cow = get_cow_or_404(db, cow_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cow, key, value)
    db.commit()
    db.refresh(cow)
    return cow


@router.delete("/{cow_id}", status_code=204)
def delete_cow(cow_id: int, db: Session = Depends(get_db)):
    cow = get_cow_or_404(db, cow_id)
    photo = cow.photo_url
    db.delete(cow)
    db.commit()
    remove_photo_file(photo)


# ---------- Santé ----------
@router.get("/{cow_id}/health")
def cow_health(cow_id: int, db: Session = Depends(get_db)):
    get_cow_or_404(db, cow_id)
    events = db.scalars(
        select(models.HealthEvent)
        .where(models.HealthEvent.cow_id == cow_id)
        .order_by(models.HealthEvent.date.desc())
    ).all()
    return [
        {"id": e.id, "date": e.date, "event_type": e.event_type, "description": e.description}
        for e in events
    ]


# ---------- Photo ----------
@router.post("/{cow_id}/photo", response_model=schemas.CowOut)
async def upload_photo(cow_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    cow = get_cow_or_404(db, cow_id)

    ext = ALLOWED_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Format accepté : JPG, PNG ou WebP")

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Image trop lourde (5 Mo maximum)")

    # Nom unique : évite que le navigateur affiche l'ancienne photo en cache
    filename = f"{cow.id}-{uuid.uuid4().hex[:8]}{ext}"
    (COW_PHOTOS_DIR / filename).write_bytes(content)

    remove_photo_file(cow.photo_url)
    cow.photo_url = f"/uploads/cows/{filename}"
    db.commit()
    db.refresh(cow)
    return cow


@router.delete("/{cow_id}/photo", response_model=schemas.CowOut)
def delete_photo(cow_id: int, db: Session = Depends(get_db)):
    cow = get_cow_or_404(db, cow_id)
    remove_photo_file(cow.photo_url)
    cow.photo_url = None
    db.commit()
    db.refresh(cow)
    return cow