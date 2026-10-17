"use client";

import { Banknote, Check, CreditCard, MessageSquareText, Minus, Plus, Trash2, UserRound, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import PrepBadge from "@/components/PrepBadge";
import { translations } from "@/lib/translations";
import { getSocket, send } from "@/lib/socket";
import { formatPrice, formatTime } from "@/lib/format";
import { getTableOrder } from "@/app/actions";
import type { OrderItem, OrderNote, PaymentMethod, Settings, Table } from "@/lib/types";

export default function DashboardClient({ initialTables, settings }: { initialTables: Table[]; settings: Settings }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [tables, setTables] = useState(initialTables);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [orderNotes, setOrderNotes] = useState<OrderNote[]>([]);
    const [managerName, setManagerName] = useState(settings.manager_name || "Kasa Yöneticisi");
    const selectedRef = useRef<number | null>(null);
    // Ödeme penceresi: null kapalı, değilse alınan tutar girdisi
    const [paidInput, setPaidInput] = useState<string | null>(null);
    const [method, setMethod] = useState<PaymentMethod>("cash");
    const [closing, setClosing] = useState(false);

    const loadOrder = async (tableId: number) => {
        const order = await getTableOrder(tableId);
        if (selectedRef.current !== tableId) return; // bu sırada başka masa seçildi
        setOrderItems(order?.items ?? []);
        setOrderNotes(order?.notes ?? []);
    };

    const selectTable = (tableId: number | null) => {
        selectedRef.current = tableId;
        setSelectedId(tableId);
        setPaidInput(null);
        setOrderItems([]);
        setOrderNotes([]);
        if (tableId !== null) loadOrder(tableId);
    };

    useEffect(() => {
        const socket = getSocket();
        const onTableUpdate = (d: { id: number; status: Table["status"] }) =>
            setTables((prev) => prev.map((table) => (table.id === d.id ? { ...table, status: d.status } : table)));
        const onOrderChange = (d: { tableId: number }) => { if (selectedRef.current === d.tableId) loadOrder(d.tableId); };
        const onSettings = (d: Settings) => setManagerName(d.manager_name);
        const onRefresh = () => window.location.reload();

        socket.on("table_update", onTableUpdate);
        socket.on("new_order_notification", onOrderChange);
        socket.on("settings_refresh", onSettings);
        socket.on("tables_refresh", onRefresh);
        return () => {
            socket.off("table_update", onTableUpdate);
            socket.off("new_order_notification", onOrderChange);
            socket.off("settings_refresh", onSettings);
            socket.off("tables_refresh", onRefresh);
        };
    }, []);

    const selectedIndex = tables.findIndex((table) => table.id === selectedId);
    const selectedTable = tables[selectedIndex];
    const occupiedCount = tables.filter((table) => table.status === "occupied").length;
    const total = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

    const openPayment = () => { setPaidInput(total.toFixed(2)); setMethod("cash"); };
    const closeTable = async () => {
        if (selectedId === null || closing) return;
        setClosing(true);
        const ok = await send("close_table", { tableId: selectedId, paidAmount: paidInput === "" ? undefined : Number(paidInput), paymentMethod: method });
        setClosing(false);
        if (ok) selectTable(null);
    };
    const paid = paidInput === null || paidInput === "" ? total : Number(paidInput);
    const removeItem = (itemId: number) => send("remove_order_item", { tableId: selectedId, itemId });
    const changeQty = (itemId: number, change: 1 | -1) => send("update_order_item_quantity", { tableId: selectedId, itemId, change });

    return (
        <AppShell active="/dashboard" headerExtra={
            <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{managerName}</span>
                <span className="text-xs text-success-ink">{t.online}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ background: "var(--surface-hover)" }}><UserRound size={16} strokeWidth={2} /></div>
            </div>
        }>
            <div className="flex-1 p-6">
                <div className="flex items-center justify-between mb-6">
                    <span className="px-4 py-1.5 bg-accent rounded-lg text-sm font-semibold text-accent-fg">{t.tables}</span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.occupiedCount}: {occupiedCount} / {tables.length}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {tables.map((table, index) => {
                        const occupied = table.status === "occupied";
                        return (
                            <button key={table.id} onClick={() => selectTable(table.id)}
                                className={`relative p-6 rounded-xl border transition-all duration-200 text-center hover:scale-[1.02] ${selectedId === table.id ? "ring-2 ring-accent" : ""}`}
                                style={{ background: occupied ? "var(--table-occupied-bg)" : "var(--table-free-bg)", borderColor: occupied ? "var(--table-occupied-border)" : "var(--table-free-border)" }}>
                                <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${occupied ? "bg-danger" : "bg-success"}`} />
                                <div className="text-3xl font-bold mb-1">{index + 1}</div>
                                <div className="text-xs" style={{ color: occupied ? "var(--danger-ink)" : "var(--text-muted)" }}>{occupied ? t.occupied : t.free}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedTable && (
                <div className="fixed inset-y-0 right-0 w-96 shadow-2xl z-50 flex flex-col" style={{ background: "var(--order-panel-bg)", borderLeft: "1px solid var(--border-color)" }}>
                    <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <div>
                            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.tableNumber}</div>
                            <div className="text-2xl font-bold">{selectedIndex + 1}</div>
                        </div>
                        <button onClick={() => selectTable(null)} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ background: "var(--surface-hover)" }} aria-label="Kapat"><X size={18} strokeWidth={2} /></button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        {orderNotes.length > 0 && (
                            <div className="mb-3 space-y-1">
                                {orderNotes.map((n) => (
                                    <div key={n.id} className="text-sm px-3 py-2 rounded-lg bg-warning/15 text-warning-ink flex items-start gap-2">
                                        <MessageSquareText size={15} strokeWidth={2} className="mt-0.5 shrink-0" /> <span>{n.note} <span className="text-xs opacity-70">· {formatTime(n.created_at)}</span></span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {orderItems.length === 0 ? (
                            <p className="text-center mt-8" style={{ color: "var(--text-muted)" }}>{t.noExistingOrder}</p>
                        ) : (
                            <div className="space-y-3">
                                {orderItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--card-bg)" }}>
                                        <div>
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-sm text-success-ink">{formatPrice(item.price * item.quantity)}</div>
                                            <PrepBadge status={item.prep_status} station={item.station_name} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => changeQty(item.id, -1)} className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--surface-hover)" }} aria-label="−"><Minus size={14} strokeWidth={2} /></button>
                                            <span className="w-6 text-center">{item.quantity}</span>
                                            <button onClick={() => changeQty(item.id, 1)} className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--surface-hover)" }} aria-label="+"><Plus size={14} strokeWidth={2} /></button>
                                            <button onClick={() => removeItem(item.id)} className="ml-2 p-1 text-danger-ink hover:opacity-70" aria-label="Sil"><Trash2 size={16} strokeWidth={2} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                        <div className="flex justify-between mb-4 text-lg font-bold">
                            <span>{t.total}</span>
                            <span className="text-success-ink">{formatPrice(total)}</span>
                        </div>
                        {selectedTable.status === "occupied" && paidInput === null && (
                            <button onClick={openPayment} className="w-full py-3 bg-danger hover:bg-danger-hover rounded-xl font-semibold text-white transition-colors">{t.closeTable}</button>
                        )}
                        {selectedTable.status === "occupied" && paidInput !== null && (
                            <div className="space-y-3">
                                <div className="font-bold flex items-center gap-2"><CreditCard size={18} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.payment}</div>
                                <label className="block">
                                    <span className="text-sm mb-1 block" style={{ color: "var(--text-secondary)" }}>{t.paidAmount}</span>
                                    <input type="number" min={0} step="0.01" value={paidInput} onChange={(e) => setPaidInput(e.target.value)} autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && closeTable()} className="field w-full text-lg font-bold" />
                                </label>
                                {Number.isFinite(paid) && Math.abs(total - paid) >= 0.005 && (
                                    <div className="flex justify-between text-sm">
                                        <span style={{ color: "var(--text-secondary)" }}>{t.discount}</span>
                                        <span className={total - paid > 0 ? "text-warning-ink" : "text-success-ink"}>{formatPrice(paid - total)}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {(["cash", "card"] as const).map((m) => (
                                        <button key={m} onClick={() => setMethod(m)}
                                            className={`py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${method === m ? "bg-accent text-accent-fg" : ""}`}
                                            style={method !== m ? { background: "var(--surface-hover)" } : undefined}>
                                            {m === "cash" ? <><Banknote size={16} strokeWidth={2} /> {t.cash}</> : <><CreditCard size={16} strokeWidth={2} /> {t.card}</>}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setPaidInput(null)} className="px-4 py-3 rounded-xl font-semibold" style={{ background: "var(--surface-hover)" }}>{t.cancel}</button>
                                    <button onClick={closeTable} disabled={closing}
                                        className="flex-1 py-3 bg-success hover:bg-success-hover disabled:opacity-60 rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2"><Check size={18} strokeWidth={2} /> {t.confirmClose}</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AppShell>
    );
}
