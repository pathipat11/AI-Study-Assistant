from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# ✅ ฟอนต์ Unicode (รองรับภาษาไทย)
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

def chat_to_pdf_bytes(title: str, messages: list[dict]) -> bytes:
    buf = BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    styles["Normal"].fontName = "STSong-Light"
    styles["Normal"].fontSize = 11
    styles["Normal"].leading = 16

    styles.add(
        ParagraphStyle(
            name="TitleStyle",
            fontName="STSong-Light",
            fontSize=16,
            leading=20,
            spaceAfter=14,
        )
    )

    styles.add(
        ParagraphStyle(
            name="RoleStyle",
            fontName="STSong-Light",
            fontSize=12,
            leading=16,
            spaceBefore=10,
            spaceAfter=4,
            textColor="#1f2937",  # slate-800
        )
    )

    story = []

    # Title
    story.append(Paragraph(title, styles["TitleStyle"]))
    story.append(Spacer(1, 12))

    for m in messages:
        role = "User" if m.get("role") == "user" else "Assistant"
        content = (m.get("content") or "").replace("\n", "<br/>")

        story.append(Paragraph(f"<b>{role}:</b>", styles["RoleStyle"]))
        story.append(Paragraph(content, styles["Normal"]))
        story.append(Spacer(1, 10))

    doc.build(story)
    return buf.getvalue()
