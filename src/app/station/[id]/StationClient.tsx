"use client";

import { BellRing, Check, MessageSquareText, Printer } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/components/Providers";
import ThemeLangToggle from "@/components/ThemeLangToggle";
import { translations } from "@/lib/translations";
import { getSocket, send } from "@/lib/socket";
import { formatTime } from "@/lib/format";
import { beep } from "@/lib/beep";
import { printInFrame, ticketUrl } from "@/lib/print";
import { getStationTickets, type StationTickets as Tickets } from "@/app/actions";
import type { Station } from "@/lib/types";

// SQLite CURRENT_TIMESTAMP değerleri UTC olarak saklanır
const minutesSince = (sqliteUtc: string, now: number) => Math.max(0, Math.floor((now - Date.parse(sqliteUtc.replace(" ", "T") + "Z")) / 60_000));

export default function StationClient({ station, initialTickets }: { station: Station; initialTickets: Tickets }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [tickets, setTickets] = useState(initialTickets);
    const [now, setNow] = useState(() => Date.now());
    const [busy, setBusy] = useState<number | null>(null);

    const reload = useCallback(async () => setTickets(await getStationTickets(station.id)), [station.id]);

    useEffect(() => {
        const socket = getSocket();
        const onUpdate = (d: { stationId: number; newTicket?: boolean }) => {
            if (d.stationId !== station.id) return;
            if (d.newTicket) beep();
            reload();
        };
        const onRefresh = () => window.location.reload();
        // Bağlantı koptuysa arada kaçan siparişleri yeniden yükle
        socket.on("connect", reload);
        socket.on("station_update", onUpdate);
        socket.on("stations_refresh", onRefresh);
        socket.on("tables_refresh", reload);
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => {
            socket.off("connect", reload);
            socket.off("station_update", onUpdate);
            socket.off("stations_refresh", onRefresh);
            socket.off("tables_refresh", reload);
            clearInterval(timer);
        };
    }, [station.id, reload]);

    const [printing, setPrinting] = useState<number | null>(null);

    /** Kasa yazıcısında sunucu üzerinden, cihaz yazıcısında gizli bir çerçevede tarayıcı yazdırmasıyla basar. */
    const printTicket = async (batchId: number) => {
        if (printing !== null) return;
        setPrinting(batchId);
        if (station.print_mode === "cashier") {
            await send("print_ticket", { stationId: station.id, batchId }, 25_000);
        } else {
            await printInFrame(ticketUrl(station.id, batchId));
        }
        setPrinting(null);
    };

    const printButton = (batchId: number) => station.print_mode !== "none" && (
        <button onClick={() => printTicket(batchId)} disabled={printing !== null} title={t.print} aria-label={t.print}
            className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors" style={{ background: "var(--surface-hover)" }}>
            <Printer size={16} strokeWidth={2} className={printing === batchId ? "animate-pulse" : undefined} />
        </button>
    );

    const update = async (event: "mark_ticket_ready" | "deliver_ticket", batchId: number) => {
        setBusy(batchId);
        await send(event, { stationId: station.id, batchId });
        setBusy(null);
    };

    const elapsed = (createdAt: string) => {
        const m = minutesSince(createdAt, now);
        return m === 0 ? t.justNow : `${m} ${t.minutesAgo}`;
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
            <header className="flex items-center justify-between p-4" style={{ background: "var(--card-bg)", borderBottom: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-3">
                    <div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.station}</div>
                        <h1 className="text-xl font-bold">{station.name}</h1>
                    </div>
                    <span className="ml-2 px-3 py-1 rounded-full text-sm font-bold bg-warning/20 text-warning-ink">{tickets.pending.length}</span>
                </div>
                <ThemeLangToggle />
            </header>

            <main className="flex-1 p-4 space-y-8">
                <section>
                    <h2 className="font-bold mb-3">{t.pendingTickets}</h2>
                    {tickets.pending.length === 0 ? (
                        <p className="text-center py-12" style={{ color: "var(--text-muted)" }}>{t.noPendingTickets}</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {tickets.pending.map((ticket) => {
                                const minutes = minutesSince(ticket.createdAt, now);
                                const urgency = minutes >= 15 ? "border-danger" : minutes >= 8 ? "border-warning" : "border-transparent";
                                return (
                                    <div key={ticket.batchId} className={`rounded-xl flex flex-col border-2 ${urgency}`} style={{ background: "var(--surface)" }}>
                                        <div className="flex items-center justify-between p-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                                            <div>
                                                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.tableNumber}</div>
                                                <div className="text-3xl font-extrabold leading-none">{ticket.tableNo}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right text-sm">
                                                    <div className="font-semibold">{formatTime(ticket.createdAt)}</div>
                                                    <div className={minutes >= 15 ? "text-danger-ink font-semibold" : ""} style={minutes < 15 ? { color: "var(--text-muted)" } : undefined}>{elapsed(ticket.createdAt)}</div>
                                                </div>
                                                {printButton(ticket.batchId)}
                                            </div>
                                        </div>
                                        <ul className="p-3 space-y-1 flex-1">
                                            {ticket.items.map((item) => (
                                                <li key={item.id} className="text-lg"><span className="font-extrabold">{item.quantity}×</span> {item.name}</li>
                                            ))}
                                        </ul>
                                        {ticket.notes.map((note, i) => (
                                            <div key={i} className="mx-3 mb-2 text-sm px-3 py-2 rounded-lg bg-warning/15 text-warning-ink font-medium flex items-start gap-2"><MessageSquareText size={15} strokeWidth={2} className="mt-0.5 shrink-0" /> {note}</div>
                                        ))}
                                        <div className="flex gap-2 m-3 mt-1">
                                            <button onClick={() => update("mark_ticket_ready", ticket.batchId)} disabled={busy === ticket.batchId}
                                                className="flex-1 py-3 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 rounded-lg font-bold text-accent-fg transition-colors">
                                                <BellRing size={18} strokeWidth={2} /> {t.markReady}
                                            </button>
                                            <button onClick={() => update("deliver_ticket", ticket.batchId)} disabled={busy === ticket.batchId} title={t.markDelivered}
                                                className="px-4 py-3 rounded-lg font-bold flex items-center justify-center disabled:opacity-60 transition-colors" style={{ background: "var(--surface-hover)" }}>
                                                <Check size={18} strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {tickets.ready.length > 0 && (
                    <section>
                        <h2 className="font-bold mb-3 text-info-ink flex items-center gap-2"><BellRing size={18} strokeWidth={2} /> {t.readyTickets}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {tickets.ready.map((ticket) => (
                                <div key={ticket.batchId} className="rounded-xl p-3 border-2 border-info/60" style={{ background: "var(--surface)" }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-2xl font-extrabold">{t.tableNumber} {ticket.tableNo}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.waitingWaiter}</span>
                                            {printButton(ticket.batchId)}
                                        </span>
                                    </div>
                                    <div className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                                        {ticket.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                                    </div>
                                    <button onClick={() => update("deliver_ticket", ticket.batchId)} disabled={busy === ticket.batchId}
                                        className="w-full py-2 flex items-center justify-center gap-2 bg-success hover:bg-success-hover disabled:opacity-60 rounded-lg font-bold text-white transition-colors">
                                        <Check size={18} strokeWidth={2} /> {t.markDelivered}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {tickets.delivered.length > 0 && (
                    <section>
                        <h2 className="font-bold mb-3" style={{ color: "var(--text-secondary)" }}>{t.deliveredTickets}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 opacity-70">
                            {tickets.delivered.map((ticket) => (
                                <div key={ticket.batchId} className="card rounded-xl p-3 text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold">{t.tableNumber} {ticket.tableNo}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-success-ink font-semibold flex items-center gap-1"><Check size={14} strokeWidth={2} /> {t.delivered} {ticket.deliveredAt && formatTime(ticket.deliveredAt)}</span>
                                            {printButton(ticket.batchId)}
                                        </span>
                                    </div>
                                    <div style={{ color: "var(--text-secondary)" }}>
                                        {ticket.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
