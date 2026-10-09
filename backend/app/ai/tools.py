"""
Outils accessibles à l'assistant IA.
⚠ Lecture seule : aucun outil ne modifie la base.
"""
from datetime import date, timedelta
from statistics import mean

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import models

Cow = models.Cow
Milk = models.MilkProduction
Health = models.HealthEvent
Expense = models.Expense


def last_data_date(db: Session) -> date:
    return db.scalar(select(func.max(Milk.date))) or date.today()


def _parse(value: str, default: date) -> date:
    try:
        return date.fromisoformat(value.strip()[:10])
    except (ValueError, AttributeError):
        return default


def _range(db: Session, start_date: str, end_date: str) -> tuple[date, date]:
    last = last_data_date(db)
    start = _parse(start_date, last - timedelta(days=6))
    end = _parse(end_date, last)
    return (start, end) if start <= end else (end, start)


def _label(cow: models.Cow) -> str:
    return f"{cow.name or 'Sans nom'} #{cow.ear_tag}"


def build_tools(db: Session, used: list[str]):
    """Crée les outils liés à la session de base de données. `used` enregistre les outils appelés."""

    def get_farm_overview() -> dict:
        """Vue d'ensemble de la ferme : nombre de vaches, vaches en lactation et taries,
        répartition par race, production du dernier jour et moyenne des 7 derniers jours."""
        used.append("get_farm_overview")
        last = last_data_date(db)
        total = db.scalar(select(func.count(Cow.id))) or 0
        lactating = db.scalar(select(func.count(Cow.id)).where(Cow.status == "active")) or 0
        breeds = db.execute(select(Cow.breed, func.count(Cow.id)).group_by(Cow.breed)).all()
        last_day = db.scalar(select(func.sum(Milk.quantity_liters)).where(Milk.date == last)) or 0
        week = db.scalar(
            select(func.sum(Milk.quantity_liters)).where(Milk.date > last - timedelta(days=7))
        ) or 0
        return {
            "date_dernieres_donnees": last.isoformat(),
            "vaches_total": total,
            "vaches_en_lactation": lactating,
            "vaches_taries": total - lactating,
            "repartition_par_race": {b: n for b, n in breeds},
            "production_dernier_jour_litres": round(last_day, 1),
            "moyenne_journaliere_7_jours_litres": round(week / 7, 1),
        }

    def get_milk_production(start_date: str, end_date: str) -> dict:
        """Production de lait totale du troupeau entre deux dates incluses (format AAAA-MM-JJ) :
        total, moyenne par jour, meilleur et plus faible jour, et détail jour par jour."""
        used.append("get_milk_production")
        start, end = _range(db, start_date, end_date)
        rows = db.execute(
            select(Milk.date, func.sum(Milk.quantity_liters), func.count(Milk.id))
            .where(Milk.date.between(start, end))
            .group_by(Milk.date)
            .order_by(Milk.date)
        ).all()
        if not rows:
            return {"message": f"Aucune production enregistrée entre {start} et {end}"}
        total = sum(r[1] for r in rows)
        best = max(rows, key=lambda r: r[1])
        worst = min(rows, key=lambda r: r[1])
        return {
            "periode": f"{start} → {end}",
            "total_litres": round(total, 1),
            "jours_avec_donnees": len(rows),
            "moyenne_par_jour_litres": round(total / len(rows), 1),
            "meilleur_jour": {"date": best[0].isoformat(), "litres": round(best[1], 1)},
            "jour_le_plus_faible": {"date": worst[0].isoformat(), "litres": round(worst[1], 1)},
            "detail_par_jour": [
                {"date": d.isoformat(), "litres": round(l, 1), "vaches_traites": c}
                for d, l, c in rows[-31:]
            ],
        }

    def get_cow_ranking(start_date: str, end_date: str, limit: int = 5, order: str = "desc") -> dict:
        """Classement des vaches selon leur production moyenne par jour sur une période
        (dates AAAA-MM-JJ). order='desc' pour les meilleures productrices, 'asc' pour les plus faibles."""
        used.append("get_cow_ranking")
        start, end = _range(db, start_date, end_date)
        avg = func.avg(Milk.quantity_liters)
        rows = db.execute(
            select(Cow, avg, func.sum(Milk.quantity_liters))
            .join(Milk, Milk.cow_id == Cow.id)
            .where(Milk.date.between(start, end))
            .group_by(Cow.id)
            .order_by(avg.asc() if order == "asc" else avg.desc())
            .limit(max(1, min(limit, 20)))
        ).all()
        return {
            "periode": f"{start} → {end}",
            "classement": [
                {
                    "rang": i + 1,
                    "vache": _label(c),
                    "race": c.breed,
                    "moyenne_litres_par_jour": round(a, 1),
                    "total_litres": round(t, 1),
                }
                for i, (c, a, t) in enumerate(rows)
            ],
        }

    def get_production_changes(days: int = 7, threshold_percent: float = 10.0) -> dict:
        """Compare la production moyenne de chaque vache sur les `days` derniers jours avec les
        `days` jours précédents. Retourne les vaches en baisse de plus de `threshold_percent` %,
        avec leurs événements de santé récents, ainsi que les plus fortes hausses.
        À utiliser pour détecter et expliquer les baisses de production."""
        used.append("get_production_changes")
        days = max(1, min(days, 60))
        last = last_data_date(db)
        recent_start = last - timedelta(days=days - 1)
        prev_end = recent_start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=days - 1)

        def averages(start: date, end: date) -> dict[int, float]:
            rows = db.execute(
                select(Milk.cow_id, func.avg(Milk.quantity_liters))
                .where(Milk.date.between(start, end))
                .group_by(Milk.cow_id)
            ).all()
            return {cow_id: value for cow_id, value in rows}

        recent, previous = averages(recent_start, last), averages(prev_start, prev_end)
        cows = {c.id: c for c in db.scalars(select(Cow).where(Cow.id.in_(list(recent)))).all()}
        changes = [
            (cows[cid], previous[cid], value, (value - previous[cid]) / previous[cid] * 100)
            for cid, value in recent.items()
            if previous.get(cid)
        ]
        drops = sorted([c for c in changes if c[3] <= -threshold_percent], key=lambda c: c[3])

        events: dict[int, list[str]] = {}
        if drops:
            for e in db.scalars(
                select(Health).where(
                    Health.cow_id.in_([c[0].id for c in drops]), Health.date >= prev_start
                )
            ).all():
                events.setdefault(e.cow_id, []).append(f"{e.event_type} le {e.date.isoformat()}")

        def fmt(c):
            return {
                "vache": _label(c[0]),
                "moyenne_avant_litres": round(c[1], 1),
                "moyenne_recente_litres": round(c[2], 1),
                "variation_pourcent": round(c[3], 1),
            }

        return {
            "periode_recente": f"{recent_start} → {last}",
            "periode_precedente": f"{prev_start} → {prev_end}",
            "nombre_vaches_en_baisse": len(drops),
            "baisses": [
                {**fmt(c), "evenements_sante_recents": events.get(c[0].id, [])} for c in drops[:15]
            ],
            "plus_fortes_hausses": [fmt(c) for c in sorted(changes, key=lambda c: -c[3])[:3]],
        }

    def find_cows(
        breed: str = "",
        status: str = "",
        min_avg_liters: float = 0.0,
        max_avg_liters: float = 0.0,
        days: int = 7,
        search: str = "",
    ) -> dict:
        """Recherche des vaches avec des filtres combinables. Laisser un filtre vide (ou à 0) pour l'ignorer.
        breed : race (Holstein, Montbéliarde, Brune des Alpes, Pie Rouge).
        status : 'active' (en lactation) ou 'dry' (tarie).
        min_avg_liters / max_avg_liters : production moyenne par jour sur les `days` derniers jours.
        search : partie du nom ou du numéro de boucle."""
        used.append("find_cows")
        last = last_data_date(db)
        start = last - timedelta(days=max(1, days) - 1)
        avg_sub = (
            select(Milk.cow_id, func.avg(Milk.quantity_liters).label("avg"))
            .where(Milk.date.between(start, last))
            .group_by(Milk.cow_id)
            .subquery()
        )
        q = select(Cow, avg_sub.c.avg).outerjoin(avg_sub, avg_sub.c.cow_id == Cow.id)
        if breed:
            q = q.where(func.lower(Cow.breed) == breed.lower())
        if status in ("active", "dry"):
            q = q.where(Cow.status == status)
        if search:
            q = q.where(or_(Cow.name.ilike(f"%{search}%"), Cow.ear_tag.contains(search.lstrip("#"))))
        if min_avg_liters:
            q = q.where(avg_sub.c.avg >= min_avg_liters)
        if max_avg_liters:
            q = q.where(avg_sub.c.avg <= max_avg_liters)
        rows = db.execute(q.order_by(Cow.ear_tag)).all()
        return {
            "periode_moyenne": f"{start} → {last}",
            "nombre_resultats": len(rows),
            "vaches": [
                {
                    "vache": _label(c),
                    "race": c.breed,
                    "statut": "en lactation" if c.status == "active" else "tarie",
                    "numero_lactation": c.lactation_number,
                    "moyenne_litres_par_jour": round(a, 1) if a else None,
                }
                for c, a in rows[:30]
            ],
        }

    def get_cow_details(identifier: str) -> dict:
        """Fiche détaillée d'une vache à partir de son numéro de boucle (ex. '0012' ou '#12') ou de son nom :
        informations, production des 30 derniers jours, tendance sur 7 jours et historique de santé."""
        used.append("get_cow_details")
        ident = identifier.strip().lstrip("#")
        cow = None
        if ident.isdigit():
            cow = db.scalar(select(Cow).where(Cow.ear_tag.in_([ident, ident.zfill(4)])))
        if cow is None:
            matches = db.scalars(select(Cow).where(Cow.name.ilike(ident)).order_by(Cow.ear_tag)).all()
            if len(matches) > 1:
                return {
                    "message": "Plusieurs vaches portent ce nom. Demande le numéro de boucle.",
                    "vaches": [_label(c) for c in matches],
                }
            cow = matches[0] if matches else None
        if cow is None:
            return {"message": f"Aucune vache trouvée pour « {identifier} »"}

        last = last_data_date(db)
        records = db.execute(
            select(Milk.date, Milk.quantity_liters)
            .where(Milk.cow_id == cow.id, Milk.date > last - timedelta(days=30))
            .order_by(Milk.date)
        ).all()
        values = [q for _, q in records]
        recent, previous = values[-7:], values[-14:-7]
        events = db.scalars(
            select(Health).where(Health.cow_id == cow.id).order_by(Health.date.desc())
        ).all()

        return {
            "vache": _label(cow),
            "race": cow.breed,
            "age_ans": (last - cow.birth_date).days // 365,
            "poids_kg": cow.weight,
            "statut": "en lactation" if cow.status == "active" else "tarie",
            "numero_lactation": cow.lactation_number,
            "production_30_derniers_jours": {
                "jours_enregistres": len(values),
                "moyenne_litres_par_jour": round(mean(values), 1) if values else None,
                "moyenne_7_derniers_jours": round(mean(recent), 1) if recent else None,
                "moyenne_7_jours_precedents": round(mean(previous), 1) if previous else None,
                "derniere_traite": (
                    {"date": records[-1][0].isoformat(), "litres": records[-1][1]} if records else None
                ),
                "detail": [{"date": d.isoformat(), "litres": q} for d, q in records],
            },
            "historique_sante": [
                {"date": e.date.isoformat(), "type": e.event_type, "description": e.description}
                for e in events
            ],
        }

    def get_health_events(start_date: str, end_date: str, event_type: str = "") -> dict:
        """Événements de santé (Mammite, Boiterie, Vêlage) entre deux dates incluses (AAAA-MM-JJ).
        event_type filtre sur un type précis ; le laisser vide pour tous les types."""
        used.append("get_health_events")
        start, end = _range(db, start_date, end_date)
        q = select(Health, Cow).join(Cow, Cow.id == Health.cow_id).where(Health.date.between(start, end))
        if event_type:
            q = q.where(func.lower(Health.event_type) == event_type.lower())
        rows = db.execute(q.order_by(Health.date.desc())).all()
        counts: dict[str, int] = {}
        for e, _ in rows:
            counts[e.event_type] = counts.get(e.event_type, 0) + 1
        return {
            "periode": f"{start} → {end}",
            "total": len(rows),
            "par_type": counts,
            "evenements": [
                {"date": e.date.isoformat(), "type": e.event_type, "vache": _label(c), "description": e.description}
                for e, c in rows[:40]
            ],
        }

    def get_expenses(start_date: str, end_date: str) -> dict:
        """Dépenses de la ferme entre deux dates incluses (AAAA-MM-JJ), en dinars tunisiens (TND) :
        total, répartition par catégorie (Alimentation, Vétérinaire, Salaires, Énergie) et principales dépenses."""
        used.append("get_expenses")
        start, end = _range(db, start_date, end_date)
        rows = db.execute(
            select(Expense.category, func.sum(Expense.amount), func.count(Expense.id))
            .where(Expense.date.between(start, end))
            .group_by(Expense.category)
            .order_by(func.sum(Expense.amount).desc())
        ).all()
        top = db.scalars(
            select(Expense).where(Expense.date.between(start, end)).order_by(Expense.amount.desc()).limit(5)
        ).all()
        return {
            "periode": f"{start} → {end}",
            "total_tnd": round(sum(r[1] for r in rows), 2),
            "par_categorie": [
                {"categorie": cat, "total_tnd": round(total, 2), "nombre": n} for cat, total, n in rows
            ],
            "principales_depenses": [
                {"date": e.date.isoformat(), "categorie": e.category, "montant_tnd": e.amount, "description": e.description}
                for e in top
            ],
        }

    return [
        get_farm_overview,
        get_milk_production,
        get_cow_ranking,
        get_production_changes,
        find_cows,
        get_cow_details,
        get_health_events,
        get_expenses,
    ]