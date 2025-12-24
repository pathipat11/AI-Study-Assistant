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

function copyAssistantMessage(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = "Copied ✓";
        btn.classList.add("text-green-500");
        setTimeout(() => {
            btn.textContent = old;
            btn.classList.remove("text-green-500");
        }, 1500);
    });
}

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = "Copied ✓";
        btn.classList.add("text-green-500");
        setTimeout(() => {
            btn.textContent = old;
            btn.classList.remove("text-green-500");
        }, 1200);
    });
}

function stripMarkdown(md) {
    if (!md) return "";
    return md
        .replace(/```[\s\S]*?```/g, (m) =>
            m.replace(/```/g, "")
        )
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[*_~>#-]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1");
}


// ===== Markdown renderer =====
function renderAssistantMarkdown(text, { streaming = false } = {}) {
    const container = document.createElement("div");
    container.className = "chatgpt-md";

    // ✅ ระหว่าง stream: อย่า parse markdown (กัน fence ยังไม่ปิดแล้วเพี้ยน)
    if (streaming) {
        container.textContent = text || "";
        return container;
    }

    const hasMarked = typeof window.marked !== "undefined";
    const hasPurify = typeof window.DOMPurify !== "undefined";

    if (!hasMarked || !hasPurify) {
        container.textContent = text || "";
        return container;
    }

    const html = window.marked.parse(text || "", { breaks: true });
    const clean = window.DOMPurify.sanitize(html);
    container.innerHTML = clean;

    container.querySelectorAll("pre").forEach((pre) => {
        const codeEl = pre.querySelector("code");
        if (codeEl && typeof window.hljs !== "undefined") {
            window.hljs.highlightElement(codeEl);
        }

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Copy";
        btn.className = "md-copy absolute top-2 right-2 text-xs px-2 py-1 rounded-lg";
        btn.onclick = () => {
            const code = codeEl ? codeEl.innerText : pre.innerText;
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
                "ai-bubble relative max-w-[70%] rounded-2xl px-6 py-4 " +
                "bg-white dark:bg-slate-900 shadow-sm";

            /* ===== Actions (Copy dropdown) ===== */
            const actions = document.createElement("div");
            actions.className =
                "ai-actions absolute top-3 right-3 flex items-center gap-2 text-xs";

            const copyBtn = document.createElement("button");
            copyBtn.textContent = "Copy";
            copyBtn.className =
                "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400";

            const menu = document.createElement("div");
            menu.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            menu.className =
                "hidden absolute right-0 mt-6 w-40 rounded-lg border " +
                "bg-white dark:bg-slate-800 shadow-lg z-10";

            const copyMd = document.createElement("button");
            copyMd.textContent = "Copy as Markdown";
            copyMd.className =
                "block w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700";
            copyMd.onclick = () => {
                copyText(m.content, copyBtn);
                menu.classList.add("hidden");
            };

            const copyTxt = document.createElement("button");
            copyTxt.textContent = "Copy as Text";
            copyTxt.className =
                "block w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700";
            copyTxt.onclick = () => {
                copyText(stripMarkdown(m.content), copyBtn);
                menu.classList.add("hidden");
            };

            menu.append(copyMd, copyTxt);
            actions.append(copyBtn, menu);

            copyBtn.onclick = (e) => {
                e.stopPropagation();
                menu.classList.toggle("hidden");
            };

            bubble.appendChild(actions);

            /* ===== Markdown content ===== */
            const content = renderAssistantMarkdown(m.content, { streaming: !!m.streaming });
            bubble.appendChild(content);

            /* ===== Streaming cursor ===== */
            if (m.streaming) {
                const cursor = document.createElement("span");
                cursor.textContent = "▍";
                cursor.className = "animate-pulse ml-1 text-slate-400";
                bubble.appendChild(cursor);
            }

            /* ===== Regenerate (last only) ===== */
            if (isLastAssistant(idx) && !m.streaming) {
                const regenWrap = document.createElement("div");
                regenWrap.className = "mt-3 text-sm text-slate-500";

                const regen = document.createElement("button");
                regen.textContent = "🔄 Regenerate";
                regen.className =
                    "hover:text-indigo-600 dark:hover:text-indigo-400";
                regen.onclick = () => window.__chat.regenerateStream();

                regenWrap.appendChild(regen);
                bubble.appendChild(regenWrap);
            }
        }


        wrap.appendChild(bubble);
        chat.appendChild(wrap);
    });

    scrollChatBottom();
}

document.addEventListener("click", () => {
    document
        .querySelectorAll(".ai-actions > div:not(.hidden)")
        .forEach(menu => menu.classList.add("hidden"));
});

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

            const item = document.createElement("div");

            item.className =
                "group relative flex items-center gap-2 rounded-2xl p-3 mb-2 border cursor-pointer " +
                (isActive
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900");

            item.dataset.sessionId = s.id;

            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="font-semibold truncate">${s.title || `Session #${s.id}`}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                    ${s.last_preview || "—"}
                    </div>
                </div>

                <!-- ⋯ menu -->
                <button
                    class="opacity-0 group-hover:opacity-100 transition
                        rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    data-action="menu">
                    ⋯
                </button>

                <div
                    class="hidden absolute right-2 top-10 z-20 w-32 rounded-xl border
                        bg-white dark:bg-slate-900 shadow-lg text-sm"
                    data-menu>
                    <button data-action="rename"
                    class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                    Rename
                    </button>
                    <button data-action="delete"
                    class="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    Delete
                    </button>
                </div>
                `;
            sessionsEl.appendChild(item);
        });
}

function formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function updateHeader() {
    const s = state.sessions.find(
        x => String(x.id) === String(state.activeSessionId)
    );

    if (s?.level) {
        state.activeLevel = s.level;
        qs("level").value = s.level;
    }

    qs("activeTitle").textContent = s?.title || "—";

    qs("activeMeta").textContent = s?.last_at
        ? `Last message: ${formatDateTime(s.last_at)}`
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
