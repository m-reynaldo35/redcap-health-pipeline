import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from auth import router as auth_router
from routers import upload, review, redcap, records, stats, settings_router, inspector

load_dotenv()

app = FastAPI(title="REDCap Health Pipeline", version="1.0.0")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(review.router, prefix="/api", tags=["review"])
app.include_router(redcap.router, prefix="/api", tags=["redcap"])
app.include_router(records.router, prefix="/api", tags=["records"])
app.include_router(stats.router, prefix="/api", tags=["stats"])
app.include_router(settings_router.router, prefix="/api", tags=["settings"])
app.include_router(inspector.router, prefix="/api", tags=["inspector"])


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
