import { state } from "./state.js";

export function qs(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
}

export function setStatus(text) {
    qs("status").textContent = text || "";
}

export function scrollChatBottom() {
    const chat = qs("chat");
    chat.scrollTop = chat.scrollHeight;
}

// ===== Markdown renderer =====
function renderAssistantMarkdown(text) {
    const html = marked.parse(text || "", { breaks: true });
    const clean = DOMPurify.sanitize(html);

    const container = document.createElement("div");
    container.className = "chatgpt-md";
    container.innerHTML = clean;

    container.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
    });

    return container;
}

export function renderChat() {
    const chat = qs("chat");
    chat.innerHTML = "";

    state.messages.forEach((m) => {
        const wrap = document.createElement("div");
        wrap.className =
            "flex w-full " +
            (m.role === "user" ? "justify-end" : "justify-start");

        const bubble = document.createElement("div");

        if (m.role === "user") {
            // USER bubble (เหมือน ChatGPT)
            bubble.className =
                "max-w-[70%] rounded-2xl px-4 py-3 " +
                "bg-indigo-600 text-white whitespace-pre-wrap";
            bubble.textContent = m.content;
        } else {
            // ASSISTANT bubble
            bubble.className =
                "max-w-[70%] rounded-2xl px-6 py-4 " +
                "bg-white dark:bg-slate-900 " +
                "shadow-sm";

            bubble.appendChild(renderAssistantMarkdown(m.content));
        }

        wrap.appendChild(bubble);
        chat.appendChild(wrap);
    });

    scrollChatBottom();
}

export function renderSessions() {
    const sessionsEl = qs("sessions");
    const search = (qs("search").value || "").toLowerCase();

    sessionsEl.innerHTML = "";
    state.sessions
        .filter(s =>
            !search ||
            (s.title || "").toLowerCase().includes(search) ||
            (s.last_preview || "").toLowerCase().includes(search)
        )
        .forEach((s) => {
            const isActive = String(s.id) === String(state.activeSessionId);

            const item = document.createElement("button");
            item.className =
                "w-full text-left rounded-2xl p-3 mb-2 border " +
                (isActive
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950");
            item.dataset.sessionId = s.id;

            item.innerHTML = `
        <div class="font-semibold truncate">${s.title || `Session #${s.id}`}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          ${s.last_preview || "—"}
        </div>
      `;

            sessionsEl.appendChild(item);
        });
}

export function updateHeader() {
    const s = state.sessions.find(x => String(x.id) === String(state.activeSessionId));
    qs("activeTitle").textContent = s?.title || "—";
    qs("activeMeta").textContent = s?.last_at
        ? `Last message: ${s.last_at}`
        : `Session ID: ${state.activeSessionId || "—"}`;
}
