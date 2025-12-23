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
