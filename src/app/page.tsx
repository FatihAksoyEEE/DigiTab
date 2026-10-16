"use client";

import Link from "next/link";
import { useLang } from "@/components/Providers";
import ThemeLangToggle from "@/components/ThemeLangToggle";

export default function HomePage() {
    const { lang } = useLang();

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
            {/* Top right controls */}
            <div className="fixed top-4 right-4 z-10">
                <ThemeLangToggle />
            </div>

            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-6xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Adisyon Projesi
                </h1>
                <p className="text-lg mb-12" style={{ color: "var(--text-secondary)" }}>
                    Modern Restoran Yönetim Sistemi
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
                    <Link href="/dashboard"
                        className="group relative p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold mb-2">
                            {lang === "TR" ? "Kasa Paneli" : "Cashier Panel"}
                        </h2>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {lang === "TR" ? "Masaları yönetin, siparişleri takip edin ve hesapları alın." : "Manage tables, track orders, and handle payments."}
                        </p>
                    </Link>

                    <Link href="/waiter"
                        className="group relative p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold mb-2">
                            {lang === "TR" ? "Garson Ekranı" : "Waiter Screen"}
                        </h2>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {lang === "TR" ? "Hızlı sipariş alın, masaların durumunu görüntüleyin." : "Quickly take orders, view table status."}
                        </p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
