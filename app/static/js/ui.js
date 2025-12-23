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

export function renderChat() {
    const chat = qs("chat");
    chat.innerHTML = "";

    state.messages.forEach((m) => {
        const wrap = document.createElement("div");
        wrap.className = "flex " + (m.role === "user" ? "justify-end" : "justify-start");

        const b = document.createElement("div");
        b.className =
            "max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed border " +
            (m.role === "user"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100");
        b.textContent = m.content;

        wrap.appendChild(b);
        chat.appendChild(wrap);
    });

    scrollChatBottom();
}

export function renderSessions() {
    const sessionsEl = qs("sessions");
    const search = (qs("search").value || "").toLowerCase();

    sessionsEl.innerHTML = "";
    const filtered = state.sessions.filter((s) => {
        const t = (s.title || "").toLowerCase();
        const p = (s.last_preview || "").toLowerCase();
        return !search || t.includes(search) || p.includes(search);
    });

    filtered.forEach((s) => {
        const isActive = String(s.id) === String(state.activeSessionId);

        const item = document.createElement("button");
        item.className =
            "w-full text-left rounded-2xl p-3 mb-2 border " +
            (isActive
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900");
        item.dataset.sessionId = s.id;

        const title = document.createElement("div");
        title.className = "font-semibold truncate";
        title.textContent = s.title || `Session #${s.id}`;

        const preview = document.createElement("div");
        preview.className = "text-xs text-slate-500 dark:text-slate-400 mt-1";
        preview.textContent = s.last_preview || "—";

        item.appendChild(title);
        item.appendChild(preview);
        sessionsEl.appendChild(item);
    });
}

export function updateHeader() {
    const activeTitleEl = document.getElementById("activeTitle");
    const activeMetaEl = document.getElementById("activeMeta");
    const s = state.sessions.find((x) => String(x.id) === String(state.activeSessionId));

    if (activeTitleEl) activeTitleEl.textContent = s?.title || "—";
    if (activeMetaEl) activeMetaEl.textContent = s?.last_at ? `Last message: ${s.last_at}` : `Session ID: ${state.activeSessionId || "—"}`;
}
