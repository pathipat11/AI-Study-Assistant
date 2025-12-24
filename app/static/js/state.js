const SESSION_KEY = "study_session_id";

export const state = {
    activeSessionId: localStorage.getItem(SESSION_KEY),
    sessions: [],
    messages: [],
    activeLevel: "beginner",
};

export function setActiveSessionId(id) {
    state.activeSessionId = String(id);
    localStorage.setItem(SESSION_KEY, state.activeSessionId);
}

export function clearActiveSessionId() {
    state.activeSessionId = null;
    localStorage.removeItem(SESSION_KEY);
}
