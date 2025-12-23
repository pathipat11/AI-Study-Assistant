from fastapi import FastAPI, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .db import get_db
from .models import ChatSession, ChatMessage
from .init_db import init_db
from .gemini_client import chat_reply
from .pdf_utils import chat_to_pdf_bytes

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# 0) list sessions (ล่าสุดขึ้นก่อน)
@app.get("/api/sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .order_by(ChatSession.created_at.desc(), ChatSession.id.desc())
        .limit(50)
        .all()
    )

    # เอา last message preview มาช่วยให้ดูดีขึ้น (MVP ทำแบบ query เพิ่มทีละ session ก็พอ)
    result = []
    for s in sessions:
        last = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == s.id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .first()
        )
        result.append({
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_preview": (last.content[:80] + "…") if last and len(last.content) > 80 else (last.content if last else ""),
            "last_at": last.created_at.isoformat() if last and last.created_at else None,
        })
    return {"sessions": result}

# 1) rename session
@app.patch("/api/sessions/{session_id}")
def rename_session(session_id: int, payload: dict, db: Session = Depends(get_db)):
    title = (payload.get("title") or "").strip()
    if not title:
        return JSONResponse({"error": "Title required"}, status_code=400)

    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    s.title = title[:200]
    db.commit()
    return {"ok": True, "id": s.id, "title": s.title}

# 2) delete session (จะลบ messages ตาม cascade)
@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    db.delete(s)
    db.commit()
    return {"ok": True}

# 1) สร้าง session ใหม่
@app.post("/api/sessions")
def create_session(payload: dict, db: Session = Depends(get_db)):
    title = payload.get("title") or "Study Chat"
    s = ChatSession(title=title)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"session_id": s.id, "title": s.title}

# 2) โหลดรายการข้อความของ session
@app.get("/api/sessions/{session_id}/messages")
def get_messages(session_id: int, db: Session = Depends(get_db)):
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )
    return {
        "session_id": session_id,
        "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat() if m.created_at else None} for m in msgs]
    }

# 3) ส่งข้อความ (chat) + บันทึกลง DB
@app.post("/api/sessions/{session_id}/chat")
def chat(session_id: int, payload: dict, db: Session = Depends(get_db)):
    user_text = (payload.get("message") or "").strip()
    level = payload.get("level", "beginner")
    if not user_text:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    # check session exists
    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    # save user msg
    db.add(ChatMessage(session_id=session_id, role="user", content=user_text))
    db.commit()

    # fetch recent messages for context (last 20)
    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(20)
        .all()
    )
    recent = list(reversed(recent))
    context = [{"role": m.role, "content": m.content} for m in recent]

    # ask gemini
    answer = chat_reply(context, level=level)

    # save assistant msg
    db.add(ChatMessage(session_id=session_id, role="assistant", content=answer))
    db.commit()

    return {"reply": answer}

# 4) Export PDF ทั้งบทสนทนา
@app.post("/api/sessions/{session_id}/export-pdf")
def export_pdf(session_id: int, db: Session = Depends(get_db)):
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )
    payload_msgs = [{"role": m.role, "content": m.content} for m in msgs]
    pdf_bytes = chat_to_pdf_bytes("Study Chat", payload_msgs)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="study-chat.pdf"'},
    )
