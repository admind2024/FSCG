import { useState, useEffect } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    return stored ? stored === "dark" : true; // default dark
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Sync initial state with html class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}
