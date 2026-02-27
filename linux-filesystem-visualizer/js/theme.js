const THEME_KEY = "linuxFsTheme";

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
}

function getSavedTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    return "light";
  }
  return "light";
}

function createOrGetToggleButton() {
  let button = document.getElementById("themeToggle");
  if (button) return button;

  const nav = document.querySelector("nav");
  if (!nav) return null;

  button = document.createElement("button");
  button.id = "themeToggle";
  button.type = "button";
  button.className = "theme-toggle";
  nav.prepend(button);
  return button;
}

function setToggleLabel(button) {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  button.textContent = current === "dark" ? "Light" : "Dark";
  button.setAttribute("aria-label", "Toggle light and dark theme");
}

export function initThemeToggle() {
  const savedTheme = getSavedTheme();
  setTheme(savedTheme);

  const button = createOrGetToggleButton();
  if (!button) return;

  setToggleLabel(button);
  button.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    setToggleLabel(button);
  });
}
