"use client";

import { useState, useEffect, useRef } from "react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { getSocket, send } from "@/lib/socket";
import { formatPrice, formatTime } from "@/lib/format";
import { getTableOrder } from "@/app/actions";
import type { OrderItem, OrderNote, Settings, Table } from "@/lib/types";

export default function DashboardClient({ initialTables, settings }: { initialTables: Table[]; settings: Settings }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [tables, setTables] = useState(initialTables);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [orderNotes, setOrderNotes] = useState<OrderNote[]>([]);
    const [managerName, setManagerName] = useState(settings.manager_name || "Kasa Yöneticisi");
    const selectedRef = useRef<number | null>(null);

    const loadOrder = async (tableId: number) => {
        const order = await getTableOrder(tableId);
        if (selectedRef.current !== tableId) return; // bu sırada başka masa seçildi
        setOrderItems(order?.items ?? []);
        setOrderNotes(order?.notes ?? []);
    };

    const selectTable = (tableId: number | null) => {
        selectedRef.current = tableId;
        setSelectedId(tableId);
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

    const closeTable = () => { if (selectedId !== null) { send("close_table", { tableId: selectedId }); selectTable(null); } };
    const removeItem = (itemId: number) => send("remove_order_item", { tableId: selectedId, itemId });
    const changeQty = (itemId: number, change: 1 | -1) => send("update_order_item_quantity", { tableId: selectedId, itemId, change });

    return (
        <AppShell active="/dashboard" headerExtra={
            <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{managerName}</span>
                <span className="text-xs text-emerald-500">{t.online}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ background: "var(--surface-hover)" }}>👤</div>
            </div>
        }>
            <div className="flex-1 p-6">
                <div className="flex items-center justify-between mb-6">
                    <span className="px-4 py-1.5 bg-blue-600 rounded-lg text-sm font-semibold text-white">{t.tables}</span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.occupiedCount}: {occupiedCount} / {tables.length}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {tables.map((table, index) => {
                        const occupied = table.status === "occupied";
                        return (
                            <button key={table.id} onClick={() => selectTable(table.id)}
                                className={`relative p-6 rounded-xl border transition-all duration-200 text-center hover:scale-[1.02] ${selectedId === table.id ? "ring-2 ring-blue-500" : ""}`}
                                style={{ background: occupied ? "var(--table-occupied-bg)" : "var(--table-free-bg)", borderColor: occupied ? "var(--table-occupied-border)" : "var(--table-free-border)" }}>
                                <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${occupied ? "bg-rose-400" : "bg-emerald-400"}`} />
                                <div className="text-3xl font-bold mb-1">{index + 1}</div>
                                <div className="text-xs" style={{ color: occupied ? "#fb7185" : "var(--text-muted)" }}>{occupied ? t.occupied : t.free}</div>
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
                        <button onClick={() => selectTable(null)} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ background: "var(--surface-hover)" }}>✕</button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        {orderNotes.length > 0 && (
                            <div className="mb-3 space-y-1">
                                {orderNotes.map((n) => (
                                    <div key={n.id} className="text-sm px-3 py-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                        📝 {n.note} <span className="text-xs opacity-70">· {formatTime(n.created_at)}</span>
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
                                            <div className="text-sm text-emerald-500">{formatPrice(item.price * item.quantity)}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => changeQty(item.id, -1)} className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--surface-hover)" }}>−</button>
                                            <span className="w-6 text-center">{item.quantity}</span>
                                            <button onClick={() => changeQty(item.id, 1)} className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--surface-hover)" }}>+</button>
                                            <button onClick={() => removeItem(item.id)} className="ml-2 text-red-400 hover:text-red-300 text-sm">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                        <div className="flex justify-between mb-4 text-lg font-bold">
                            <span>{t.total}</span>
                            <span className="text-emerald-500">{formatPrice(total)}</span>
                        </div>
                        {selectedTable.status === "occupied" && (
                            <button onClick={closeTable} className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded-xl font-semibold text-white transition-colors">{t.closeTable}</button>
                        )}
                    </div>
                </div>
            )}
        </AppShell>
    );
}
