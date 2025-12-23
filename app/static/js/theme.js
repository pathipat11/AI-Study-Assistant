(() => {
    const THEME_KEY = "theme_mode"; // "dark" | "light"

    function applyTheme(mode) {
        const root = document.documentElement;
        if (mode === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
    }

    function getSavedTheme() {
        return localStorage.getItem(THEME_KEY) || "dark";
    }

    function updateThemeUI() {
        const mode = getSavedTheme();
        const btn = document.getElementById("btnTheme");
        const badge = document.getElementById("themeBadge");
        if (badge) badge.textContent = mode === "dark" ? "Dark" : "Light";
        if (btn) btn.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
    }

    function updateHighlightTheme(mode) {
        document.documentElement.dataset.theme = mode;
    }

    function toggleTheme() {
        const next = getSavedTheme() === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
        updateHighlightTheme(next);
        updateThemeUI();
    }

    // apply ASAP (กันกระพริบ)
    applyTheme(getSavedTheme());
    window.__theme = { toggleTheme, updateThemeUI };
})();
