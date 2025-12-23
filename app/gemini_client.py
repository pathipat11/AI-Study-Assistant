import os
import google.generativeai as genai

SYSTEM_INSTRUCTION = """
You are a helpful study assistant chatbot.
You explain clearly, step-by-step when needed, and provide short examples.
If the user asks for code, provide Python code with comments.
"""

def chat_reply(messages: list[dict], level: str = "beginner") -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in environment")

    genai.configure(api_key=api_key)

    # ใช้โมเดลที่เหมาะกับแชท
    model = genai.GenerativeModel("gemini-2.5-flash", system_instruction=SYSTEM_INSTRUCTION)

    # แปลง messages เป็นข้อความเดียว (MVP ง่ายสุด)
    # messages: [{role:"user"/"assistant", content:"..."}]
    transcript = []
    transcript.append(f"(Audience level: {level})")
    for m in messages[-20:]:  # จำกัด context กันยาวเกิน
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "user":
            transcript.append(f"User: {content}")
        else:
            transcript.append(f"Assistant: {content}")

    prompt = "\n".join(transcript) + "\nAssistant:"
    resp = model.generate_content(prompt)
    return (resp.text or "").strip()

def generate_chat_title(first_user_message: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in environment")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = f"""
Create a short chat session title (3-6 words) based on the user's first message.
Return ONLY the title text. No quotes. No emoji.

User message: {first_user_message}
"""
    resp = model.generate_content(prompt)
    title = (resp.text or "").strip()

    # กันพลาด: ตัดบรรทัด/ตัดยาว
    title = title.splitlines()[0].strip()
    return title[:60] or "Study Chat"

def chat_reply_stream(messages: list[dict], level: str = "beginner"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY")

    genai.configure(api_key=api_key)

    # ✅ ใช้โมเดลเดียวกับ non-stream
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        system_instruction=SYSTEM_INSTRUCTION
        + "\n\nIMPORTANT: Always respond in GitHub-flavored Markdown."
        + "\n- Use bullet points for summaries"
        + "\n- Use fenced code blocks ```python for code"
    )

    transcript = [f"(Audience level: {level})"]
    for m in messages[-20:]:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "user":
            transcript.append(f"User: {content}")
        else:
            transcript.append(f"Assistant: {content}")
    prompt = "\n".join(transcript) + "\nAssistant:"

    stream = model.generate_content(prompt, stream=True)
    for chunk in stream:
        if getattr(chunk, "text", None):
            yield chunk.text
