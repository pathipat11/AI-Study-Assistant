from fastapi import FastAPI, Request, Depends, APIRouter, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .db import get_db, SessionLocal
from .models import ChatSession, ChatMessage
from .init_db import init_db
from .gemini_client import chat_reply, chat_reply_stream, generate_chat_title
from .pdf_utils import chat_to_pdf_bytes

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

@app.on_event("startup")
def on_startup():
    init_db()

def sse_data(text: str) -> str:
    # SSE ต้อง prefix data: ทุกบรรทัด
    lines = (text or "").splitlines()
    if not lines:
        return "data:\n\n"
    return "".join(f"data: {line}\n" for line in lines) + "\n"

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
            "level": s.level,
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
    level = payload.get("level", "beginner")
    s = ChatSession(title=title, level=level)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {
        "session_id": s.id,
        "title": s.title,
        "level": s.level,
    }

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
    
    # ✅ Auto-title: ถ้าเป็นข้อความแรกของห้อง และ title ยังเป็นค่า default
    DEFAULT_TITLES = {"New Chat", "Study Chat"}
    total = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).count()

    if total == 1 and (s.title in DEFAULT_TITLES):
        try:
            new_title = generate_chat_title(user_text)
            s.title = new_title[:200]
            db.commit()
        except Exception:
            # ไม่ให้พังทั้งระบบถ้า gen title fail
            db.rollback()
            pass


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

    return {"reply": answer, "session_title": s.title}

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

@app.post("/api/sessions/{session_id}/regenerate")
def regenerate(session_id: int, db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .all()
    )

    last_user = next((m for m in messages if m.role == "user"), None)
    last_assistant = next((m for m in messages if m.role == "assistant"), None)

    if not last_user:
        raise HTTPException(400, "No user message to regenerate")

    if last_assistant:
        db.delete(last_assistant)
        db.commit()

    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(20)
        .all()
    )
    recent = list(reversed(recent))
    context = [{"role": m.role, "content": m.content} for m in recent]

    reply = chat_reply(context, level="beginner")

    db.add(ChatMessage(session_id=session_id, role="assistant", content=reply))
    db.commit()

    return {"reply": reply}

@app.post("/api/sessions/{session_id}/chat/stream")
def chat_stream(session_id: int, payload: dict, db: Session = Depends(get_db)):
    user_text = (payload.get("message") or "").strip()
    if not user_text:
        raise HTTPException(400, "Empty message")

    # ✅ query session ก่อน
    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    # ✅ level ใช้ของ session เป็น default
    level = (payload.get("level") or s.level or "beginner").strip()

    # ✅ save user msg
    db.add(ChatMessage(session_id=session_id, role="user", content=user_text))
    db.commit()

    # ✅ context
    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(20)
        .all()
    )
    recent = list(reversed(recent))
    context = [{"role": m.role, "content": m.content} for m in recent]

    # ✅ auto-title (เหมือนเดิม)
    DEFAULT_TITLES = {"New Chat", "Study Chat"}
    try:
        total = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).count()
        if total == 1 and (s.title in DEFAULT_TITLES):
            new_title = generate_chat_title(user_text)
            s.title = (new_title or "Study Chat")[:200]
            db.commit()
    except Exception:
        db.rollback()

    def event_generator():
        full = ""
        try:
            for chunk in chat_reply_stream(context, level):
                if not chunk:
                    continue
                full += chunk
                yield sse_data(chunk)

            db2 = SessionLocal()
            try:
                db2.add(ChatMessage(session_id=session_id, role="assistant", content=full))
                db2.commit()
            finally:
                db2.close()

            yield "event: done\ndata: ok\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/sessions/{session_id}/regenerate/stream")
def regenerate_stream(session_id: int, db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    # ✅ ดึงล่าสุด (ใหม่ -> เก่า)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .all()
    )

    last_user = next((m for m in messages if m.role == "user"), None)
    last_assistant = next((m for m in messages if m.role == "assistant"), None)

    if not last_user:
        raise HTTPException(400, "No user message to regenerate")

    # ✅ อย่าลบ assistant ก่อน stream (ถ้า stream fail จะหาย)
    # context ใช้ 20 ข้อความล่าสุด (ยังมี assistant เก่าอยู่ก็ไม่เป็นไร)
    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(20)
        .all()
    )
    recent = list(reversed(recent))
    context = [{"role": m.role, "content": m.content} for m in recent]

    def event_gen():
        full = ""
        try:
            for chunk in chat_reply_stream(context, level="beginner"):
                if not chunk:
                    continue
                full += chunk
                yield sse_data(chunk)

            # ✅ stream สำเร็จค่อย “replace” ใน Session ใหม่แบบ atomic
            db2 = SessionLocal()
            try:
                # ลบ assistant เก่าล่าสุด (ถ้ามี)
                if last_assistant:
                    obj = db2.query(ChatMessage).filter(ChatMessage.id == last_assistant.id).first()
                    if obj:
                        db2.delete(obj)
                        db2.flush()

                # insert assistant ใหม่
                db2.add(ChatMessage(session_id=session_id, role="assistant", content=full))
                db2.commit()
            finally:
                db2.close()

            yield "event: done\ndata: ok\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.patch("/api/sessions/{session_id}/level")
def update_session_level(session_id: int, payload: dict, db: Session = Depends(get_db)):
    level = payload.get("level")
    if level not in {"beginner", "intermediate", "advanced"}:
        raise HTTPException(400, "Invalid level")

    s = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")

    s.level = level
    db.commit()
    return {"ok": True, "level": s.level}
