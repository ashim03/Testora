import { useEffect } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function getSystemTheme(): "light" | "dark" {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function storedTheme(): Theme {
  const value = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = storedTheme();
  useEffect(() => {
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(storedTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: t }));
  };

  return { theme, setTheme };
}

export { STORAGE_KEY as THEME_STORAGE_KEY };