"use client";

import { useTheme } from "next-themes";
import { useLang } from "./Providers";
import { Moon, Sun, Globe } from "lucide-react";
import { useSyncExternalStore } from "react";

export default function ThemeLangToggle() {
    const { theme, setTheme } = useTheme();
    const { lang, setLang } = useLang();
    // Tema yalnızca tarayıcıda bilinir; sunucu render'ında düğmeleri gösterme
    const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

    if (!mounted) return null;

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => setLang(lang === "TR" ? "EN" : "TR")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
                title="Dil Değiştir"
            >
                <Globe size={16} />
                {lang}
            </button>
            <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-full transition-all duration-200"
                style={{ background: "var(--surface-hover)", color: "var(--text-primary)" }}
                title="Tema Değiştir"
            >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
        </div>
    );
}
