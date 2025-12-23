import {
    apiListSessions,
    apiCreateSession,
    apiGetMessages,
    apiChat,
    apiRenameSession,
    apiDeleteSession,
    apiExportPdf,
} from "./api.js";

import { state, setActiveSessionId, clearActiveSessionId } from "./state.js";
import { qs, setStatus, renderChat, renderSessions, updateHeader } from "./ui.js";

async function refreshSessions() {
    const data = await apiListSessions();
    state.sessions = data.sessions || [];

    // ถ้าไม่มี active ให้เลือกอันแรก
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
    state.messages = (data.messages || []).map((m) => ({ role: m.role, content: m.content }));
    renderChat();
}

async function switchSession(id) {
    setActiveSessionId(id);
    setStatus("Loading...");
    await loadHistory();
    await refreshSessions();
    setStatus("Loaded ✅");
}

async function createNew() {
    const s = await apiCreateSession("New Chat");
    setActiveSessionId(s.session_id);
    await refreshSessions();
    await loadHistory();
    setStatus("New chat ✅");
}

async function send() {
    const text = qs("msg").value.trim();
    if (!text) return;

    await ensureSession();
    qs("msg").value = "";

    state.messages.push({ role: "user", content: text });
    renderChat();
    setStatus("Thinking...");

    try {
        const level = qs("level").value;
        const data = await apiChat(state.activeSessionId, text, level);

        state.messages.push({ role: "assistant", content: data.reply });
        renderChat();

        await refreshSessions();
        setStatus("Done ✅");
    } catch (e) {
        setStatus("Error: " + e.message);
    }
}

async function renameActive() {
    if (!state.activeSessionId) return;
    const current = state.sessions.find((s) => String(s.id) === String(state.activeSessionId));
    const title = prompt("Rename session:", current?.title || "");
    if (!title) return;

    await apiRenameSession(state.activeSessionId, title);
    await refreshSessions();
    setStatus("Renamed ✅");
}

async function deleteActive() {
    if (!state.activeSessionId) return;
    if (!confirm("Delete this session? (messages will be removed)")) return;

    await apiDeleteSession(state.activeSessionId);
    clearActiveSessionId();

    await refreshSessions();
    await ensureSession();
    await refreshSessions();
    await loadHistory();

    setStatus("Deleted ✅");
}

async function exportPdf() {
    if (!state.activeSessionId) return alert("No session.");
    const blob = await apiExportPdf(state.activeSessionId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-chat.pdf";
    a.click();
    URL.revokeObjectURL(url);
}

function copyChat() {
    if (!state.messages.length) return alert("No messages yet.");
    const text = state.messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text).then(() => alert("Copied ✅"));
}

function bindEvents() {
    qs("btnSend").addEventListener("click", send);
    qs("msg").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

    qs("btnNew").addEventListener("click", createNew);
    qs("btnRename").addEventListener("click", renameActive);
    qs("btnDelete").addEventListener("click", deleteActive);

    qs("btnCopy").addEventListener("click", copyChat);
    qs("btnPdf").addEventListener("click", exportPdf);

    qs("search").addEventListener("input", renderSessions);

    // คลิก session ใน sidebar (event delegation)
    qs("sessions").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-session-id]");
        if (!btn) return;
        switchSession(btn.dataset.sessionId);
    });
}

async function init() {
    setStatus("Loading...");
    bindEvents();

    // อัปเดต badge theme
    window.__theme?.updateThemeUI?.();

    await refreshSessions();
    await ensureSession();
    await refreshSessions();
    await loadHistory();

    setStatus("Ready ✅");
}

document.addEventListener("DOMContentLoaded", init);
