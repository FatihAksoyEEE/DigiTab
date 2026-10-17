"use client";

import { Banknote, ChevronLeft, ChevronRight, CreditCard, Wallet } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { getSocket } from "@/lib/socket";
import { formatPrice, formatTime } from "@/lib/format";
import type { DailySales } from "@/lib/types";

/** YYYY-AA-GG tarihine gün ekler (saat diliminden etkilenmemesi için UTC üzerinden). */
const shiftDate = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

export default function SalesClient({ data, today }: { data: DailySales; today: string }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const router = useRouter();
    const { summary, products, sales, date } = data;
    const go = (d: string) => router.push(d === today ? "/dashboard/sales" : `/dashboard/sales?date=${d}`);

    // Başka bir masa kapatıldığında rakamları yenile
    useEffect(() => {
        const socket = getSocket();
        const onUpdate = () => router.refresh();
        socket.on("sales_update", onUpdate);
        return () => { socket.off("sales_update", onUpdate); };
    }, [router]);

    const discount = summary.total - summary.paid;
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(lang === "TR" ? "tr-TR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const stats = [
        { label: t.collected, value: formatPrice(summary.paid), accent: "text-success-ink" },
        { label: t.cash, icon: Banknote, value: formatPrice(summary.cash) },
        { label: t.card, icon: CreditCard, value: formatPrice(summary.card) },
        { label: t.closedBills, value: String(summary.count) },
        { label: t.averageBill, value: formatPrice(summary.count ? summary.paid / summary.count : 0) },
        { label: t.discount, value: formatPrice(-discount), accent: discount > 0.005 ? "text-warning-ink" : undefined },
    ] as { label: string; value: string; accent?: string; icon?: typeof Banknote }[];

    return (
        <AppShell active="/dashboard/sales">
            <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Wallet size={22} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.sales}</h2>
                        <p className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{dateLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => go(shiftDate(date, -1))} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-hover)" }} aria-label="−1"><ChevronLeft size={18} strokeWidth={2} /></button>
                        <input type="date" value={date} max={today} onChange={(e) => e.target.value && go(e.target.value)} className="field" />
                        <button onClick={() => go(shiftDate(date, 1))} disabled={date >= today} className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40" style={{ background: "var(--surface-hover)" }} aria-label="+1"><ChevronRight size={18} strokeWidth={2} /></button>
                        {date !== today && (
                            <button onClick={() => go(today)} className="px-3 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-semibold text-accent-fg">{t.today}</button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {stats.map((s) => (
                        <div key={s.label} className="card rounded-xl p-4">
                            <div className="text-xs mb-1 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>{s.icon && <s.icon size={14} strokeWidth={2} />}{s.label}</div>
                            <div className={`text-xl font-bold tabular-nums ${s.accent ?? ""}`}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {summary.count === 0 ? (
                    <p className="text-center py-12" style={{ color: "var(--text-muted)" }}>{t.noSales}</p>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="card rounded-2xl p-5 lg:col-span-3">
                            <h3 className="font-bold text-lg mb-3">{t.productSales}</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left" style={{ color: "var(--text-secondary)" }}>
                                        <th className="py-2 font-medium">{t.product}</th>
                                        <th className="py-2 font-medium text-right">{t.quantity}</th>
                                        <th className="py-2 font-medium text-right">{t.revenue}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((p) => (
                                        <tr key={`${p.name}|${p.category}`} style={{ borderTop: "1px solid var(--border-color)" }}>
                                            <td className="py-2">
                                                <div className="font-medium">{p.name}</div>
                                                {p.category && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{p.category}</div>}
                                            </td>
                                            <td className="py-2 text-right tabular-nums font-semibold">{p.quantity}</td>
                                            <td className="py-2 text-right tabular-nums">{formatPrice(p.revenue)}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold" style={{ borderTop: "2px solid var(--border-color)" }}>
                                        <td className="py-2">{t.billTotal}</td>
                                        <td className="py-2 text-right tabular-nums">{products.reduce((s, p) => s + p.quantity, 0)}</td>
                                        <td className="py-2 text-right tabular-nums">{formatPrice(summary.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>{t.productRevenueNote}</p>
                        </div>

                        <div className="card rounded-2xl p-5 lg:col-span-2">
                            <h3 className="font-bold text-lg mb-3">{t.billList}</h3>
                            <div className="space-y-2 max-h-[32rem] overflow-auto">
                                {sales.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ background: "var(--surface-secondary)" }}>
                                        <div>
                                            <div className="font-semibold">{t.tableNumber} {s.table_no} · {formatTime(s.closed_at)}</div>
                                            <div className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                                {s.item_count} {t.quantity.toLowerCase()} ·{" "}
                                                {s.payment_method === "cash" ? <><Banknote size={13} /> {t.cash}</> : <><CreditCard size={13} /> {t.card}</>}
                                            </div>
                                        </div>
                                        <div className="text-right tabular-nums">
                                            <div className="font-bold text-success-ink">{formatPrice(s.paid_amount)}</div>
                                            {Math.abs(s.total - s.paid_amount) >= 0.005 && (
                                                <div className="text-xs line-through" style={{ color: "var(--text-muted)" }}>{formatPrice(s.total)}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
