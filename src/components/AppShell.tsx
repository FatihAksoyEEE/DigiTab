"use client";

import Link from "next/link";
import { BookOpen, LayoutGrid, Settings } from "lucide-react";
import ThemeLangToggle from "./ThemeLangToggle";

const NAV = [
    { href: "/dashboard", icon: LayoutGrid },
    { href: "/dashboard/menu", icon: BookOpen },
    { href: "/dashboard/settings", icon: Settings },
];

/** Kasa paneli sayfalarının ortak kenar çubuğu ve üst bilgisi. */
export default function AppShell({ active, headerExtra, children }: { active: string; headerExtra?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
            <aside className="w-16 flex flex-col items-center py-4 gap-6" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border-color)" }}>
                <Link href="/" className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg text-white">D</Link>
                {NAV.map(({ href, icon: Icon }) => (
                    <Link key={href} href={href} className="p-3 rounded-xl hover:opacity-80 transition-opacity"
                        style={href === active ? { background: "var(--surface-hover)" } : undefined}>
                        <Icon size={20} strokeWidth={1.5} />
                    </Link>
                ))}
            </aside>

            <main className="flex-1 flex flex-col">
                <header className="h-16 flex items-center justify-between px-6" style={{ borderBottom: "1px solid var(--border-color)", background: "var(--header-bg)" }}>
                    <h1 className="font-bold text-lg">DigiTab POS</h1>
                    <div className="flex items-center gap-4">
                        <ThemeLangToggle />
                        {headerExtra}
                    </div>
                </header>
                {children}
            </main>
        </div>
    );
}
