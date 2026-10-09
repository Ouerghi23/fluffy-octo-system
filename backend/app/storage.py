from pathlib import Path

# backend/uploads/cows/
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
COW_PHOTOS_DIR = UPLOAD_DIR / "cows"
COW_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)