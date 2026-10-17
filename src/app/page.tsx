"use client";

import Link from "next/link";
import { Monitor, Smartphone } from "lucide-react";
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
                <h1 className="text-6xl font-extrabold tracking-tight mb-4">
                    Adisyon Projesi
                </h1>
                <p className="text-lg mb-12" style={{ color: "var(--text-secondary)" }}>
                    Modern Restoran Yönetim Sistemi
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
                    <Link href="/dashboard"
                        className="group relative p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/5 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                            <Monitor size={30} strokeWidth={1.5} />
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
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                            <Smartphone size={30} strokeWidth={1.5} className="text-success-ink" />
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
