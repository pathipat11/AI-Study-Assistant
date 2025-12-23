import os, time
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import User

JWT_SECRET = os.getenv("JWT_SECRET", "dev_secret")
JWT_ALG = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "43200"))

def create_access_token(user_id: int) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + JWT_EXPIRE_MINUTES * 60,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def verify_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return int(payload.get("sub"))
    except (JWTError, ValueError):
        return None

def get_token_from_request(request: Request) -> Optional[str]:
    # ✅ cookie-first
    if request.cookies.get("access_token"):
        return request.cookies.get("access_token")

    # fallback: Authorization: Bearer ...
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bearer "):
        return auth[7:].strip()

    return None

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(401, "Not authenticated")

    uid = verify_token(token)
    if not uid:
        raise HTTPException(401, "Invalid token")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(401, "User not found")

    return user
