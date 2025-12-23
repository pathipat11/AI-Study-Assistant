export async function apiListSessions() {
    const res = await fetch("/api/sessions");
    return await res.json();
}

export async function apiCreateSession(title = "New Chat") {
    const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    return await res.json();
}

export async function apiGetMessages(sessionId) {
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    return await res.json();
}

export async function apiChat(sessionId, message, level) {
    const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, level }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Chat failed");
    return data;
}

export async function apiRenameSession(sessionId, title) {
    const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Rename failed");
    return data;
}

export async function apiDeleteSession(sessionId) {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Delete failed");
    return data;
}

export async function apiExportPdf(sessionId) {
    const res = await fetch(`/api/sessions/${sessionId}/export-pdf`, { method: "POST" });
    if (!res.ok) throw new Error("Export failed");
    return await res.blob();
}
