import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
PASSCODE = os.getenv("PIPELINE_PASSCODE", "redcap2024")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

router = APIRouter()
security = HTTPBearer()


class LoginRequest(BaseModel):
    passcode: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    return verify_token(credentials.credentials)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    if body.passcode != PASSCODE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect passcode.",
        )
    token = create_token({"sub": "researcher"})
    return TokenResponse(access_token=token)


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": user.get("sub")}
