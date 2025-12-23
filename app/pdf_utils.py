from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

def chat_to_pdf_bytes(title: str, messages: list[dict]) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    x, y = 40, height - 50

    def draw_wrapped(text, font="Helvetica", size=11, gap=14):
        nonlocal y
        c.setFont(font, size)
        max_w = width - 80
        for paragraph in text.split("\n"):
            line = paragraph.strip()
            if not line:
                y -= 8
                continue
            words = line.split(" ")
            cur = ""
            for w in words:
                test = (cur + " " + w).strip()
                if c.stringWidth(test, font, size) < max_w:
                    cur = test
                else:
                    c.drawString(x, y, cur)
                    y -= gap
                    cur = w
            if cur:
                c.drawString(x, y, cur)
                y -= gap

            if y < 60:
                c.showPage()
                y = height - 50

    c.setFont("Helvetica-Bold", 16)
    c.drawString(x, y, title[:90])
    y -= 26

    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        label = "User" if role == "user" else "Assistant"
        draw_wrapped(f"{label}:", font="Helvetica-Bold", size=12)
        draw_wrapped(content, font="Helvetica", size=11)
        y -= 6

        if y < 60:
            c.showPage()
            y = height - 50

    c.showPage()
    c.save()
    return buf.getvalue()
