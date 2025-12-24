# AI Study Assistant

AI Study Assistant is a full‑stack web application inspired by ChatGPT, designed to help users learn and review topics with the assistance of AI. The application supports multi‑session chats, streaming responses, Markdown rendering, and persistent storage using PostgreSQL.

---

## ✨ Key Features

### 🧠 AI‑Powered Chat

* Ask questions on any topic and receive AI‑generated explanations.
* Responses are formatted in **GitHub‑flavored Markdown**.
* Supports **code blocks**, **lists**, and **step‑by‑step explanations**.

### ⚡ Streaming Responses

* AI replies are streamed token‑by‑token (real‑time typing effect).
* Smooth UX similar to ChatGPT.

### 🗂 Multi‑Session Chat (Like ChatGPT)

* Create multiple chat sessions.
* Switch between sessions from the sidebar.
* Rename or delete sessions.
* Each session is stored persistently in PostgreSQL.

### 🎯 Session‑Based Learning Level

* Choose a learning level per session:

  * **Beginner**
  * **Intermediate**
  * **Advanced**
* The selected level is saved per session and affects AI responses.

### 📋 Copy & Export

* Copy AI responses **per message**:

  * Copy as Markdown
  * Copy as Plain Text
* Export the full conversation to **PDF**.

### 🌗 Dark / Light Mode

* Toggle between dark and light themes.
* Theme preference is persisted in the browser.

---

## 🛠 Tech Stack

### Frontend

* HTML + Jinja2 Templates
* Tailwind CSS (Dark Mode supported)
* Vanilla JavaScript (ES Modules)
* Markdown rendering: `marked`
* HTML sanitization: `DOMPurify`
* Syntax highlighting: `highlight.js`

### Backend

* **FastAPI** (Python)
* **Server‑Sent Events (SSE)** for streaming AI responses
* **Google Gemini API** (`gemini‑2.5‑flash`)

### Database

* **PostgreSQL**
* SQLAlchemy ORM
* Persistent storage for:

  * Chat sessions
  * Messages
  * Session learning level

---

## 📁 Project Structure (Simplified)

```
app/
├── main.py            # FastAPI application & API routes
├── db.py              # Database connection
├── models.py          # SQLAlchemy models
├── gemini_client.py   # Gemini AI integration
├── pdf_utils.py       # Export chat to PDF
├── static/
│   └── js/
│       ├── main.js    # App logic
│       ├── ui.js      # UI rendering
│       ├── api.js     # API client
│       └── state.js   # Client state
├── templates/
│   ├── base.html
│   ├── index.html
│   └── partials/
│       ├── sidebar.html
│       └── topbar.html
```

---

## 🚀 How It Works

1. User creates or selects a chat session.
2. User sends a message.
3. Backend:

   * Saves the user message to PostgreSQL.
   * Sends recent context + session level to Gemini.
   * Streams the AI response back via SSE.
4. Frontend:

   * Renders the response in real‑time.
   * Parses Markdown and highlights code.
   * Allows copying or regenerating responses.

---

## 🔐 Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/ai_study
GEMINI_API_KEY=your_gemini_api_key
```

---

## 📌 Current Status

✅ Core features implemented

* Streaming chat
* Session management
* Markdown rendering
* Copy / Export
* Dark mode
* Session‑based learning level

🚧 Possible future improvements

* Authentication (user accounts)
* Search inside chat messages
* Tagging / folders for sessions
* Rate limiting & usage tracking

---

## 📖 Inspiration

This project is inspired by **ChatGPT‑style interfaces**, built as a learning project to explore:

* AI integration
* Real‑time streaming UX
* Full‑stack web development with Python & JavaScript

---

## 👤 Author

Developed by **Pathipat** as a personal learning & portfolio project.
