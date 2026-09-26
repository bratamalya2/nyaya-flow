"use client";

import { BookOpenText, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "reader";
const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "reader", label: "Reader", icon: BookOpenText },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("nyayaflow-theme") as Theme | null;
    const initial = stored && themes.some((item) => item.value === stored) ? stored : "light";
    document.documentElement.dataset.theme = initial;
    const update = window.setTimeout(() => setTheme(initial), 0);
    return () => window.clearTimeout(update);
  }, []);

  const cycle = () => {
    const current = themes.findIndex((item) => item.value === theme);
    const next = themes[(current + 1) % themes.length].value;
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("nyayaflow-theme", next);
    setTheme(next);
  };

  const selected = themes.find((item) => item.value === theme) ?? themes[0];
  const Icon = selected.icon;
  return (
    <button className="icon-button" onClick={cycle} title={`Theme: ${selected.label}`} type="button">
      <Icon size={18} aria-hidden="true" />
      <span className="sr-only">Change theme; current theme {selected.label}</span>
    </button>
  );
}
