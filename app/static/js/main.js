import {
    apiListSessions,
    apiCreateSession,
    apiGetMessages,
    apiChat,
    apiRenameSession,
    apiDeleteSession,
    apiExportPdf,
    apiRegenerate,
} from "./api.js";

import { state, setActiveSessionId, clearActiveSessionId } from "./state.js";
import {
    qs,
    setStatus,
    renderChat,
    renderSessions,
    updateHeader,
} from "./ui.js";

/* -------------------------
 * Session / Data helpers
 * ------------------------- */
async function refreshSessions() {
    const data = await apiListSessions();
    state.sessions = data.sessions || [];

    // ถ้ายังไม่มี active session ให้เลือกอันแรก
    if (!state.activeSessionId && state.sessions.length) {
        setActiveSessionId(state.sessions[0].id);
    }

    renderSessions();
    updateHeader();
}

async function ensureSession() {
    if (state.activeSessionId) return;

    const s = await apiCreateSession("New Chat");
    setActiveSessionId(s.session_id);
}

async function loadHistory() {
    if (!state.activeSessionId) return;

    const data = await apiGetMessages(state.activeSessionId);
    state.messages = (data.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
    }));

    renderChat();
}

/* -------------------------
 * Actions
 * ------------------------- */
async function switchSession(sessionId) {
    setActiveSessionId(sessionId);
    setStatus("Loading...");

    await loadHistory();
    await refreshSessions();

    setStatus("Loaded ✅");
}

async function createNewSession() {
    const s = await apiCreateSession("New Chat");
    setActiveSessionId(s.session_id);

    await refreshSessions();
    await loadHistory();

    setStatus("New chat ✅");
}

async function sendMessage() {
    const input = qs("msg");
    const text = input.value.trim();
    if (!text) return;

    await ensureSession();
    input.value = "";

    // optimistic UI (แสดง user message ก่อน)
    state.messages.push({ role: "user", content: text });
    renderChat();
    setStatus("Thinking...");

    try {
        const level = qs("level").value;
        const data = await apiChat(state.activeSessionId, text, level);

        // ✅ Auto title: backend ส่ง session_title มา
        if (data.session_title) {
            await refreshSessions();
        }

        state.messages.push({
            role: "assistant",
            content: data.reply,
        });

        renderChat();
        await refreshSessions();

        setStatus("Done ✅");
    } catch (err) {
        console.error(err);
        setStatus("Error: " + err.message);
    }
}

async function renameActiveSession() {
    if (!state.activeSessionId) return;

    const current = state.sessions.find(
        (s) => String(s.id) === String(state.activeSessionId)
    );

    const title = prompt("Rename session:", current?.title || "");
    if (!title) return;

    await apiRenameSession(state.activeSessionId, title);
    await refreshSessions();

    setStatus("Renamed ✅");
}

async function deleteActiveSession() {
    if (!state.activeSessionId) return;

    const ok = confirm("Delete this session? (messages will be removed)");
    if (!ok) return;

    await apiDeleteSession(state.activeSessionId);
    clearActiveSessionId();

    await refreshSessions();
    await ensureSession();
    await refreshSessions();
    await loadHistory();

    setStatus("Deleted ✅");
}

async function exportPdf() {
    if (!state.activeSessionId) {
        alert("No session selected.");
        return;
    }

    const blob = await apiExportPdf(state.activeSessionId);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "study-chat.pdf";
    a.click();

    URL.revokeObjectURL(url);
}

function copyChat() {
    if (!state.messages.length) {
        alert("No messages yet.");
        return;
    }

    const text = state.messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

    navigator.clipboard.writeText(text).then(() => {
        alert("Copied ✅");
    });
}

/* -------------------------
 * Event bindings
 * ------------------------- */
function bindEvents() {
    qs("btnSend").addEventListener("click", sendMessageStream);
    qs("msg").addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    qs("btnNew").addEventListener("click", createNewSession);
    qs("btnRename").addEventListener("click", renameActiveSession);
    qs("btnDelete").addEventListener("click", deleteActiveSession);

    qs("btnCopy").addEventListener("click", copyChat);
    qs("btnPdf").addEventListener("click", exportPdf);

    qs("search").addEventListener("input", renderSessions);

    // Sidebar: click session (event delegation)
    qs("sessions").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-session-id]");
        if (!btn) return;
        switchSession(btn.dataset.sessionId);
    });
}


/* -------------------------
 * Regenerate last assistant message
 * ------------------------- */

async function regenerate() {
    if (!state.activeSessionId) return;

    setStatus("Regenerating...");

    // ลบ assistant ล่าสุดจาก state
    for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === "assistant") {
            state.messages.splice(i, 1);
            break;
        }
    }
    renderChat();

    try {
        const data = await apiRegenerate(state.activeSessionId);

        state.messages.push({
            role: "assistant",
            content: data.reply,
        });

        renderChat();
        setStatus("Done ✅");
    } catch (e) {
        setStatus("Error: " + e.message);
    }
}

async function sendMessageStream() {
    const input = qs("msg");
    const text = input.value.trim();
    if (!text) return;

    await ensureSession();
    input.value = "";

    // user bubble
    state.messages.push({ role: "user", content: text });
    renderChat();

    // assistant placeholder
    const assistant = { role: "assistant", content: "" };
    state.messages.push(assistant);
    renderChat();

    setStatus("Thinking...");

    const res = await fetch(
        `/api/sessions/${state.activeSessionId}/chat/stream`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, level: qs("level").value }),
        }
    );

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistant.content += chunk.replace(/^data:\s?/gm, "");
        renderChat();
    }

    setStatus("Done ✅");
}


/* -------------------------
 * Init
 * ------------------------- */
async function init() {
    setStatus("Loading...");
    bindEvents();

    // sync theme badge (dark/light)
    window.__theme?.updateThemeUI?.();
    window.__chat = { regenerate };

    await refreshSessions();
    await ensureSession();
    await refreshSessions();
    await loadHistory();

    setStatus("Ready ✅");
}

document.addEventListener("DOMContentLoaded", init);
