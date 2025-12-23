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

    container.querySelectorAll("pre").forEach((pre) => {
        const btn = document.createElement("button");
        btn.textContent = "Copy";
        btn.className =
            "absolute top-2 right-2 text-xs px-2 py-1 rounded bg-slate-700 text-white hover:bg-slate-600";

        btn.onclick = () => {
            const code = pre.innerText;
            navigator.clipboard.writeText(code);
            btn.textContent = "Copied";
            setTimeout(() => (btn.textContent = "Copy"), 1500);
        };

        pre.style.position = "relative";
        pre.appendChild(btn);
    });


    return container;
}

export function renderChat() {
    const chat = qs("chat");
    chat.innerHTML = "";

    state.messages.forEach((m, idx) => {
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
        }

        if (m.role === "assistant") {
            bubble.className =
                "max-w-[70%] rounded-2xl px-6 py-4 " +
                "bg-white dark:bg-slate-900 shadow-sm";

            bubble.appendChild(renderAssistantMarkdown(m.content));

            if (isLastAssistant(idx)) {
                const actions = document.createElement("div");
                actions.className = "mt-3 text-sm text-slate-500";

                const regen = document.createElement("button");
                regen.textContent = "🔄 Regenerate";
                regen.className =
                    "hover:text-indigo-600 dark:hover:text-indigo-400";
                regen.onclick = () => window.__chat.regenerate();

                actions.appendChild(regen);
                bubble.appendChild(actions);
            }
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

function isLastAssistant(index) {
    for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === "assistant") {
            return i === index;
        }
    }
    return false;
}
