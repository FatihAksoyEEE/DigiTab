"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";
import { ThemeProvider } from "next-themes";

const STORAGE_KEY = "digitab-lang";
const CHANGE_EVENT = "digitab-lang-change";

type LangContextType = {
    lang: string;
    setLang: (lang: string) => void;
};

const LangContext = createContext<LangContextType>({
    lang: "TR",
    setLang: () => {},
});

export function useLang() {
    return useContext(LangContext);
}

// Dil tercihi localStorage'da tutulur; diğer sekmelerdeki değişiklikler de yansır
const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(CHANGE_EVENT, callback);
    };
};

const setLang = (lang: string) => {
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new Event(CHANGE_EVENT));
};

export default function Providers({ children }: { children: React.ReactNode }) {
    const lang = useSyncExternalStore(subscribe, () => localStorage.getItem(STORAGE_KEY) ?? "TR", () => "TR");

    return (
        <LangContext.Provider value={{ lang, setLang }}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
                {children}
            </ThemeProvider>
        </LangContext.Provider>
    );
}
