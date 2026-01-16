#!/usr/bin/env python3
"""ISCN Karyotype Validation API Server.

Usage:
    uvicorn api.server:app --reload
    # or
    python api/server.py
"""
import sys
from pathlib import Path
from dataclasses import asdict, is_dataclass
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from iscn_authenticator.main import validate_karyotype


def to_json_serializable(obj):
    """Convert dataclass instances to JSON-serializable dicts recursively."""
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: to_json_serializable(v) for k, v in asdict(obj).items()}
    elif isinstance(obj, list):
        return [to_json_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: to_json_serializable(v) for k, v in obj.items()}
    else:
        return obj


class KaryotypeRequest(BaseModel):
    karyotype: str


class ValidationResponse(BaseModel):
    valid: bool
    errors: list[str]
    parsed: dict | None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("ISCN Validator API started")
    yield
    # Shutdown
    print("ISCN Validator API stopped")


app = FastAPI(
    title="ISCN Karyotype Validator API",
    description="Validate International System for Human Cytogenomic Nomenclature strings",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for Deno Deploy frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "ISCN Karyotype Validator",
        "version": "1.0.0",
        "endpoints": {
            "POST /validate": "Validate a karyotype string",
            "GET /validate?karyotype=...": "Validate via query parameter",
            "GET /health": "Health check",
        }
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/validate", response_model=ValidationResponse)
async def validate_post(request: KaryotypeRequest):
    """Validate a karyotype string via POST request."""
    if not request.karyotype:
        raise HTTPException(status_code=400, detail="No karyotype provided")

    result = validate_karyotype(request.karyotype)
    return to_json_serializable(result)


@app.get("/validate", response_model=ValidationResponse)
async def validate_get(karyotype: str):
    """Validate a karyotype string via GET request."""
    if not karyotype:
        raise HTTPException(status_code=400, detail="No karyotype provided")

    result = validate_karyotype(karyotype)
    return to_json_serializable(result)


if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
