from datetime import date as dt_date
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Cow(Base):
    __tablename__ = "cows"

    id: Mapped[int] = mapped_column(primary_key=True)
    ear_tag: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(50))
    breed: Mapped[str] = mapped_column(String(50))
    birth_date: Mapped[dt_date]
    weight: Mapped[float | None]
    status: Mapped[str] = mapped_column(String(20), default="active")
    lactation_number: Mapped[int] = mapped_column(default=0)
    photo_url: Mapped[str | None] = mapped_column(String(255))

    milk_records: Mapped[list["MilkProduction"]] = relationship(
        back_populates="cow", cascade="all, delete-orphan"
    )


class MilkProduction(Base):
    __tablename__ = "milk_production"

    id: Mapped[int] = mapped_column(primary_key=True)
    cow_id: Mapped[int] = mapped_column(
        ForeignKey("cows.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[dt_date] = mapped_column(index=True)
    quantity_liters: Mapped[float]

    cow: Mapped["Cow"] = relationship(back_populates="milk_records")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(50))  # alimentation, vétérinaire...
    amount: Mapped[float]
    date: Mapped[dt_date]
    description: Mapped[str | None] = mapped_column(String(255))

class HealthEvent(Base):
    __tablename__ = "health_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    cow_id: Mapped[int] = mapped_column(
        ForeignKey("cows.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[dt_date] = mapped_column(index=True)
    event_type: Mapped[str] = mapped_column(String(50))  # Mammite, Boiterie, Vêlage...
    description: Mapped[str | None] = mapped_column(String(255))