import os

from dotenv import load_dotenv
from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.ai.tools import build_tools, last_data_date

load_dotenv()

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

SYSTEM_PROMPT = """Tu es l'assistant IA de Smart Dairy, une application de gestion de ferme laitière en Tunisie.

Date de référence (dernières données disponibles) : {today}.
« Aujourd'hui » = cette date. « Cette semaine » = les 7 derniers jours. « Ce mois-ci » = du 1er du mois jusqu'à cette date.

Règles :
- Utilise TOUJOURS les outils pour obtenir les chiffres. N'invente jamais de données.
- Si une question demande plusieurs informations, appelle plusieurs outils.
- Pour expliquer une baisse de production, croise la production avec les événements de santé
  (mammite, boiterie, vêlage) et le stade de lactation. Sépare clairement ce que montrent
  les données de ce qui reste une hypothèse.
- Si les données ne permettent pas de répondre, dis-le simplement.
- Tu es en lecture seule : tu ne peux ni ajouter, ni modifier, ni supprimer de données.
  Si on te le demande, explique que cela se fait depuis l'interface de l'application.
- Tu ne poses pas de diagnostic vétérinaire : pour un problème de santé, recommande un vétérinaire.
- Réponds dans la langue de l'utilisateur, de façon claire et concise, en Markdown
  (listes, **gras** pour les chiffres clés, tableaux quand c'est utile).
- Désigne les vaches sous la forme « Nom #numéro ». Unités : litres (L) et dinars tunisiens (TND).
"""

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        if not os.getenv("GEMINI_API_KEY"):
            raise RuntimeError("Clé GEMINI_API_KEY manquante dans backend/.env")
        _client = genai.Client()  # lit GEMINI_API_KEY automatiquement
    return _client


def ask(db: Session, messages: list[dict]) -> dict:
    used: list[str] = []
    tools = build_tools(db, used)

    contents = [
        types.Content(
            role="user" if m["role"] == "user" else "model",
            parts=[types.Part(text=m["content"])],
        )
        for m in messages
    ]

    response = get_client().models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT.format(today=last_data_date(db).isoformat()),
            tools=tools,  # appel automatique des fonctions Python
        ),
    )

    return {
        "reply": response.text or "Je n'ai pas pu formuler de réponse. Pouvez-vous reformuler ?",
        "tools_used": list(dict.fromkeys(used)),  # sans doublons, ordre conservé
    }