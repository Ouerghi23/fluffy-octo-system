from app.routers import ai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import cows, milk, stats
from app.storage import UPLOAD_DIR

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Dairy AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cows.router)
app.include_router(milk.router)
app.include_router(stats.router)
app.include_router(ai.router)

# Les photos sont accessibles via http://localhost:8000/uploads/cows/...
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {"message": "Smart Dairy AI API"}