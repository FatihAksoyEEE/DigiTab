"use client";

import { ArrowLeft, BellRing, Check, LayoutGrid, MessageSquareText, Minus, Plus, ReceiptText } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/components/Providers";
import ThemeLangToggle from "@/components/ThemeLangToggle";
import PrepBadge from "@/components/PrepBadge";
import { translations } from "@/lib/translations";
import { getSocket, send } from "@/lib/socket";
import { formatPrice, formatTime } from "@/lib/format";
import { beep } from "@/lib/beep";
import { getProducts, getCategories, getTableOrder, getReadyTickets } from "@/app/actions";
import type { Category, OrderItem, OrderNote, Product, StationTicket, Table } from "@/lib/types";

type CartItem = Pick<Product, "id" | "name" | "price"> & { quantity: number };

export default function WaiterClient({ initialTables }: { initialTables: Table[] }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [tables, setTables] = useState<Table[]>(initialTables);
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [note, setNote] = useState("");
    const [existingItems, setExistingItems] = useState<OrderItem[]>([]);
    const [existingNotes, setExistingNotes] = useState<OrderNote[]>([]);
    const [showExisting, setShowExisting] = useState(true);
    const [sending, setSending] = useState(false);
    const [readyTickets, setReadyTickets] = useState<StationTicket[]>([]);

    useEffect(() => {
        Promise.all([getProducts(), getCategories()]).then(([p, c]) => {
            setProducts(p);
            setCategories(c);
            if (c.length > 0) setActiveCategory(c[0].name);
        });
        const socket = getSocket();
        const onTableUpdate = (d: { id: number; status: Table["status"] }) => setTables((p) => p.map((t) => t.id === d.id ? { ...t, status: d.status } : t));
        const onRefresh = () => window.location.reload();
        const loadReady = () => getReadyTickets().then(setReadyTickets);
        const onReady = (d?: { newReady?: boolean }) => {
            if (d?.newReady) { beep(1046, 3); navigator.vibrate?.([200, 100, 200]); }
            loadReady();
        };
        loadReady();
        socket.on("table_update", onTableUpdate);
        socket.on("tables_refresh", onRefresh);
        socket.on("ready_update", onReady);
        // Bağlantı koptuysa arada hazır olan siparişleri yeniden yükle
        socket.on("connect", loadReady);
        return () => {
            socket.off("table_update", onTableUpdate);
            socket.off("tables_refresh", onRefresh);
            socket.off("ready_update", onReady);
            socket.off("connect", loadReady);
        };
    }, []);

    const selectedRef = useRef<number | null>(null);

    const loadExistingOrder = useCallback(async (tableId: number) => {
        const order = await getTableOrder(tableId);
        if (selectedRef.current !== tableId) return; // bu sırada başka masa seçildi
        setExistingItems(order?.items ?? []);
        setExistingNotes(order?.notes ?? []);
    }, []);

    const selectTable = (table: Table | null) => {
        selectedRef.current = table?.id ?? null;
        setSelectedTable(table);
        setExistingItems([]);
        setExistingNotes([]);
        setShowExisting(true);
        if (table) loadExistingOrder(table.id);
        else setCart([]);
    };

    useEffect(() => {
        if (!selectedTable) return;
        const socket = getSocket();
        const tableId = selectedTable.id;
        const onOrderChange = (d: { tableId: number }) => { if (d.tableId === tableId) loadExistingOrder(tableId); };
        const onTableUpdate = (d: { id: number; status: string }) => { if (d.id === tableId && d.status === "free") { setExistingItems([]); setExistingNotes([]); } };
        socket.on("new_order_notification", onOrderChange);
        socket.on("table_update", onTableUpdate);
        return () => { socket.off("new_order_notification", onOrderChange); socket.off("table_update", onTableUpdate); };
    }, [selectedTable, loadExistingOrder]);

    const addToCart = (product: Product) => { setCart((prev) => { const e = prev.find((i) => i.id === product.id); if (e) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i); return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }]; }); };
    const updateCartQty = (pid: number, change: number) => { setCart((p) => p.map((i) => { if (i.id === pid) { const nq = i.quantity + change; return nq <= 0 ? null : { ...i, quantity: nq }; } return i; }).filter(Boolean) as CartItem[]); };
    const placeOrder = async () => {
        if (!selectedTable || cart.length === 0 || sending) return;
        setSending(true);
        const ok = await send("place_order", { tableId: selectedTable.id, items: cart.map((i) => ({ id: i.id, quantity: i.quantity })), waiterName: lang === "TR" ? "Garson" : "Waiter", note });
        setSending(false);
        // Sepet yalnızca sunucu siparişi kaydettiyse temizlenir
        if (ok) { setNote(""); selectTable(null); }
    };

    const filteredProducts = products.filter((p) => p.category === activeCategory);
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    // Aynı ürün farklı siparişlerde ayrı satır olarak kaydediliyor; garsona hazırlık durumuna göre tek satırda göster
    const summaryKey = (i: OrderItem) => `${i.name}|${i.price}|${i.prep_status}`;
    const existingSummary = Object.values(existingItems.reduce<Record<string, OrderItem>>((acc, i) => {
        const key = summaryKey(i);
        acc[key] = acc[key] ? { ...acc[key], quantity: acc[key].quantity + i.quantity } : { ...i };
        return acc;
    }, {}));
    const existingTotal = existingItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const existingCount = existingItems.reduce((s, i) => s + i.quantity, 0);

    // İstasyonda hazır bekleyen siparişler her ekranın üstünde görünür
    const readyBanner = readyTickets.length > 0 && (
        <div className="m-4 mb-0 rounded-xl p-3 border-2 border-info bg-info/10">
            <div className="font-bold text-info-ink mb-2 flex items-center gap-2"><BellRing size={18} strokeWidth={2} /> {t.readyOrders} ({readyTickets.length})</div>
            <div className="space-y-2 max-h-60 overflow-auto">
                {readyTickets.map((ticket) => (
                    <div key={`${ticket.batchId}|${ticket.stationId}`} className="flex items-center justify-between gap-3 p-2 rounded-lg" style={{ background: "var(--card-bg)" }}>
                        <div className="text-sm min-w-0">
                            <div className="font-bold">{t.tableNumber} {ticket.tableNo} · {ticket.stationName}</div>
                            <div style={{ color: "var(--text-secondary)" }}>{ticket.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
                        </div>
                        <button onClick={() => send("deliver_ticket", { stationId: ticket.stationId, batchId: ticket.batchId })}
                            className="shrink-0 px-3 py-2 bg-success active:bg-success-hover rounded-lg text-sm font-bold text-white flex items-center gap-1.5"><Check size={16} strokeWidth={2} /> {t.pickedUp}</button>
                    </div>
                ))}
            </div>
        </div>
    );

    if (!selectedTable) {
        return (
            <div className="min-h-screen pb-4" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
                {readyBanner}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-6 p-3 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                        <h1 className="text-lg font-bold flex items-center gap-2"><LayoutGrid size={20} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.tableSelection}</h1>
                        <ThemeLangToggle />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {tables.map((table, index) => (
                            <button key={table.id} onClick={() => selectTable(table)}
                                className="p-8 rounded-xl border text-center transition-all active:scale-95"
                                style={{ background: table.status === "occupied" ? "var(--table-occupied-bg)" : "var(--table-free-bg)", borderColor: table.status === "occupied" ? "var(--table-occupied-border)" : "var(--table-free-border)" }}>
                                <div className="text-4xl font-bold mb-2">{index + 1}</div>
                                <span className={`px-3 py-1 rounded-full text-xs ${table.status === "occupied" ? "bg-danger/15 text-danger-ink" : "text-(--text-muted)"}`} style={table.status !== "occupied" ? { background: "var(--surface-hover)" } : {}}>
                                    {table.status === "occupied" ? t.occupied : t.free}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
            <div className="flex items-center justify-between p-4" style={{ background: "var(--card-bg)" }}>
                <div className="flex items-center gap-3">
                    <button onClick={() => selectTable(null)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--surface-hover)" }} aria-label="Geri"><ArrowLeft size={18} strokeWidth={2} /></button>
                    <div>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.orderFor}</div>
                        <div className="text-xl font-bold">{tables.findIndex(t => t.id === selectedTable.id) + 1}</div>
                    </div>
                </div>
                <ThemeLangToggle />
            </div>

            {readyBanner}

            <div className="mx-4 mt-4 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <button onClick={() => setShowExisting((v) => !v)} className="w-full flex items-center justify-between p-3 text-left">
                    <span className="font-bold text-sm flex items-center gap-2"><ReceiptText size={16} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.existingOrder} ({existingCount})</span>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                        {existingItems.length > 0 && <span>{formatPrice(existingTotal)}</span>}
                        <span style={{ color: "var(--text-muted)" }}>{showExisting ? "▲" : "▼"}</span>
                    </span>
                </button>
                {showExisting && (
                    <div className="px-3 pb-3">
                        {existingSummary.length === 0 ? (
                            <div className="text-sm" style={{ color: "var(--text-muted)" }}>{t.noExistingOrder}</div>
                        ) : (
                            <div className="space-y-1 max-h-40 overflow-auto">
                                {existingSummary.map((item) => (
                                    <div key={summaryKey(item)} className="flex justify-between items-center gap-2 text-sm">
                                        <span><span className="font-semibold">{item.quantity}×</span> {item.name} <PrepBadge status={item.prep_status} /></span>
                                        <span style={{ color: "var(--text-secondary)" }}>{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {existingNotes.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {existingNotes.map((n) => (
                                    <div key={n.id} className="text-sm px-3 py-2 rounded-lg bg-warning/15 text-warning-ink flex items-start gap-2">
                                        <MessageSquareText size={15} strokeWidth={2} className="mt-0.5 shrink-0" /> <span>{n.note} <span className="text-xs opacity-70">· {formatTime(n.created_at)}</span></span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex gap-2 p-4 overflow-x-auto">
                {categories.map((cat) => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat.name ? "bg-accent text-accent-fg" : ""}`}
                        style={activeCategory !== cat.name ? { background: "var(--surface-hover)", color: "var(--text-secondary)" } : {}}>
                        {cat.name}
                    </button>
                ))}
            </div>

            <div className="flex-1 p-4 grid grid-cols-2 gap-3 content-start overflow-auto">
                {filteredProducts.map((product) => {
                    const inCart = cart.find((c) => c.id === product.id);
                    return (
                        <button key={product.id} onClick={() => addToCart(product)}
                            className="relative p-4 rounded-xl text-left transition-all active:scale-95"
                            style={{ background: "var(--table-free-bg)", border: "1px solid var(--card-border)" }}>
                            {inCart && <span className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full text-xs flex items-center justify-center font-bold text-accent-fg">{inCart.quantity}</span>}
                            <div className="font-bold text-lg mb-2">{product.name}</div>
                            <span className="px-3 py-1 bg-accent/10 text-(--text-primary) rounded-full text-sm font-semibold">{formatPrice(product.price)}</span>
                        </button>
                    );
                })}
            </div>

            {cart.length > 0 && (
                <div className="p-4" style={{ borderTop: "1px solid var(--border-color)", background: "var(--order-panel-bg)" }}>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold">{t.order} ({cart.reduce((s, i) => s + i.quantity, 0)})</h3>
                        <button onClick={() => setCart([])} className="text-danger-ink text-sm">{t.clear}</button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-auto mb-3">
                        {cart.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--card-bg)" }}>
                                <div>
                                    <div className="font-medium text-sm">{item.name}</div>
                                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{formatPrice(item.price)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => updateCartQty(item.id, -1)} className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--surface-hover)" }} aria-label="−"><Minus size={14} strokeWidth={2} /></button>
                                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                                    <button onClick={() => updateCartQty(item.id, 1)} className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--surface-hover)" }} aria-label="+"><Plus size={14} strokeWidth={2} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mb-3 font-bold text-lg"><span>{t.total}</span><span>{formatPrice(total)}</span></div>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.orderNote} maxLength={300} className="field w-full mb-3" />
                    <button onClick={placeOrder} disabled={sending} className="w-full py-3 disabled:opacity-60 bg-success hover:bg-success-hover rounded-xl font-bold text-lg text-white transition-colors flex items-center justify-center gap-2"><Check size={20} strokeWidth={2} /> {t.placeOrder}</button>
                </div>
            )}
        </div>
    );
}
