"""
Génère des données réalistes pour Smart Dairy AI.
⚠ Supprime et recrée toutes les tables à chaque exécution.
"""
import math
import random
from datetime import date, timedelta

from app.database import Base, engine, SessionLocal
from app.models import Cow, MilkProduction, Expense, HealthEvent

random.seed(42)  # mêmes données à chaque exécution

NB_COWS = 50
NB_DAYS = 180
END_DATE = date.today()
START_DATE = END_DATE - timedelta(days=NB_DAYS - 1)

LACTATION_DAYS = 305   # durée de lactation
CYCLE_DAYS = 365       # lactation + tarissement (60 jours)

# race : (proportion dans le troupeau, facteur de production)
BREEDS = {
    "Holstein": (0.55, 1.00),
    "Montbéliarde": (0.20, 0.85),
    "Brune des Alpes": (0.15, 0.80),
    "Pie Rouge": (0.10, 0.82),
}

NAMES = [
    "Bella", "Marguerite", "Noiraude", "Blanchette", "Rosa", "Lola", "Perle",
    "Nina", "Fleur", "Câline", "Douce", "Étoile", "Mimi", "Pâquerette",
    "Brunette", "Caramel", "Vanille", "Nuage", "Prune", "Cerise",
]

# maladie : (probabilité par vache, durée min, durée max, facteur de production, traitement, coût min, coût max)
DISEASES = {
    "Mammite": (0.15, 7, 14, 0.65, "Antibiotique intramammaire", 120, 250),
    "Boiterie": (0.08, 10, 20, 0.85, "Parage + anti-inflammatoire", 80, 180),
}


def wood_curve(dim: int) -> float:
    """Courbe de lactation de Wood : y = a * t^b * e^(-c*t). Pic ≈ 36 L vers 50 jours."""
    return 20 * dim ** 0.2 * math.exp(-0.004 * dim)


def season_factor(d: date) -> float:
    """Stress thermique en été : production réduite de 10 %."""
    return 0.90 if d.month in (6, 7, 8) else 1.0


def health_factor(illnesses: list, day_index: int) -> float:
    factor = 1.0
    for start, end, f in illnesses:
        if start <= day_index <= end:
            factor *= f
    return factor


def create_cows(db):
    breed_names = list(BREEDS)
    breed_weights = [v[0] for v in BREEDS.values()]
    cows, states = [], []

    for i in range(NB_COWS):
        breed = random.choices(breed_names, breed_weights)[0]
        age_years = random.uniform(2.2, 8)
        lactation_number = max(1, int(age_years - 1.5))  # 1er vêlage vers 2 ans

        cow = Cow(
            ear_tag=f"{i + 1:04d}",
            name=random.choice(NAMES),
            breed=breed,
            birth_date=START_DATE - timedelta(days=int(age_years * 365)),
            weight=round(random.uniform(520, 700) * (1 if breed == "Holstein" else 0.95)),
            status="active",
            lactation_number=lactation_number,
        )
        cows.append(cow)

        potential = BREEDS[breed][1] * random.uniform(0.85, 1.15)
        if lactation_number == 1:
            potential *= 0.85  # les primipares produisent moins

        states.append({
            "dim": random.randint(0, CYCLE_DAYS - 1),  # jours depuis le dernier vêlage
            "potential": potential,
            "illnesses": [],
        })

    db.add_all(cows)
    db.flush()  # attribue les id aux vaches
    return cows, states


def plan_illnesses(db, cows, states):
    for cow, state in zip(cows, states):
        for disease, (prob, dmin, dmax, factor, treatment, cmin, cmax) in DISEASES.items():
            if random.random() < prob:
                start = random.randint(0, NB_DAYS - 15)
                end = start + random.randint(dmin, dmax)
                state["illnesses"].append((start, end, factor))
                event_date = START_DATE + timedelta(days=start)

                db.add(HealthEvent(
                    cow_id=cow.id, date=event_date, event_type=disease,
                    description=f"Traitement : {treatment}",
                ))
                db.add(Expense(
                    category="Vétérinaire", date=event_date,
                    amount=round(random.uniform(cmin, cmax), 2),
                    description=f"{disease} — vache #{cow.ear_tag}",
                ))


def add_expenses(db, d: date, lactating_count: int):
    # Chaque lundi : achat d'aliments pour la semaine
    if d.weekday() == 0:
        db.add(Expense(
            category="Alimentation", date=d,
            amount=round(lactating_count * 7 * 8 * 1.25 * random.gauss(1, 0.05), 2),
            description="Concentré (≈ 8 kg/vache/jour)",
        ))
        db.add(Expense(
            category="Alimentation", date=d,
            amount=round(NB_COWS * 7 * 12 * 0.35 * random.gauss(1, 0.05), 2),
            description="Fourrage / foin",
        ))
    # Le 1er du mois : charges fixes
    if d.day == 1:
        db.add(Expense(category="Salaires", date=d, amount=2700.0,
                       description="3 employés"))
        db.add(Expense(category="Énergie", date=d,
                       amount=round(random.uniform(450, 750), 2),
                       description="Électricité et eau"))
        db.add(Expense(category="Vétérinaire", date=d,
                       amount=round(random.uniform(200, 450), 2),
                       description="Visite de routine"))


def simulate(db, cows, states):
    nb_records = 0
    for day_index in range(NB_DAYS):
        d = START_DATE + timedelta(days=day_index)
        lactating_count = 0

        for cow, state in zip(cows, states):
            state["dim"] += 1

            # Nouveau vêlage
            if state["dim"] > CYCLE_DAYS:
                state["dim"] = 1
                cow.lactation_number += 1
                db.add(HealthEvent(cow_id=cow.id, date=d, event_type="Vêlage",
                                   description=f"Début de la lactation n°{cow.lactation_number}"))

            # Vache tarie : pas de lait
            if state["dim"] > LACTATION_DAYS:
                continue

            lactating_count += 1
            qty = (
                wood_curve(state["dim"])
                * state["potential"]
                * season_factor(d)
                * health_factor(state["illnesses"], day_index)
                * random.gauss(1, 0.04)
            )
            db.add(MilkProduction(cow_id=cow.id, date=d, quantity_liters=round(qty, 1)))
            nb_records += 1

        add_expenses(db, d, lactating_count)

    # Statut final de chaque vache
    for cow, state in zip(cows, states):
        cow.status = "dry" if state["dim"] > LACTATION_DAYS else "active"

    return nb_records


def main():
    print("Réinitialisation de la base...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        cows, states = create_cows(db)
        plan_illnesses(db, cows, states)
        nb_records = simulate(db, cows, states)
        db.commit()
    finally:
        db.close()

    print(f"✅ {NB_COWS} vaches créées")
    print(f"✅ {nb_records} enregistrements de production ({START_DATE} → {END_DATE})")
    print("✅ Dépenses et événements de santé générés")


if __name__ == "__main__":
    main()