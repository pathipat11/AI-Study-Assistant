import time
from fastapi import HTTPException

# user_id -> [timestamps]
_BUCKET = {}

def rate_limit(user_id: int, limit: int = 20, window_sec: int = 60):
    now = time.time()
    arr = _BUCKET.get(user_id, [])
    arr = [t for t in arr if now - t < window_sec]
    if len(arr) >= limit:
        raise HTTPException(429, f"Rate limit exceeded ({limit}/{window_sec}s)")
    arr.append(now)
    _BUCKET[user_id] = arr
