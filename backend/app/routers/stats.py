from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db

router = APIRouter(prefix="/stats", tags=["Statistiques"])
Milk = models.MilkProduction
Cow = models.Cow


def get_last_date(db: Session):
    return db.scalar(select(func.max(Milk.date)))


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    last_date = get_last_date(db)
    if last_date is None:
        return {"message": "Aucune donnée"}

    total_cows = db.scalar(select(func.count(Cow.id)))
    lactating = db.scalar(select(func.count(Cow.id)).where(Cow.status == "active"))
    milk_today = db.scalar(select(func.sum(Milk.quantity_liters)).where(Milk.date == last_date))
    expenses_month = db.scalar(
        select(func.sum(models.Expense.amount)).where(models.Expense.date >= last_date.replace(day=1))
    )
    top = db.execute(
        select(Cow.id, Cow.ear_tag, Cow.name, Cow.breed, Cow.photo_url, Milk.quantity_liters)
        .join(Milk, Milk.cow_id == Cow.id)
        .where(Milk.date == last_date)
        .order_by(Milk.quantity_liters.desc())
        .limit(5)
    ).all()

    return {
        "date": last_date,
        "total_cows": total_cows,
        "lactating_cows": lactating,
        "milk_today_liters": round(milk_today or 0, 1),
        "expenses_month": round(expenses_month or 0, 2),
        "top_cows": [
            {"id": i, "ear_tag": t, "name": n, "breed": b, "photo_url": p, "liters": q}
            for i, t, n, b, p, q in top
        ],
    }


@router.get("/production")
def production(days: int = 30, db: Session = Depends(get_db)):
    last_date = get_last_date(db)
    if last_date is None:
        return []
    rows = db.execute(
        select(Milk.date, func.sum(Milk.quantity_liters), func.count(Milk.id))
        .where(Milk.date >= last_date - timedelta(days=days - 1))
        .group_by(Milk.date)
        .order_by(Milk.date)
    ).all()
    return [{"date": d, "liters": round(l, 1), "cows": c} for d, l, c in rows]


@router.get("/alerts")
def alerts(db: Session = Depends(get_db)):
    last_date = get_last_date(db)
    if last_date is None:
        return []
    H = models.HealthEvent
    rows = db.execute(
        select(H.date, H.event_type, H.description, Cow.id, Cow.ear_tag, Cow.name, Cow.breed, Cow.photo_url)
        .join(Cow, Cow.id == H.cow_id)
        .where(H.date >= last_date - timedelta(days=30))
        .order_by(H.date.desc())
        .limit(6)
    ).all()
    return [
        {
            "date": d, "event_type": t, "description": desc,
            "cow_id": i, "ear_tag": tag, "name": n, "breed": b, "photo_url": p,
        }
        for d, t, desc, i, tag, n, b, p in rows
    ]