"use server";

// Yalnızca okuma işlemleri. Veriyi değiştiren her şey server.ts'deki socket olaylarından geçer.
import { getDb } from "@/lib/db";
import type { Category, DailySales, Product, ProductSale, Sale, SaleSummary, Settings, Station, StationTicket, Table, TableOrder } from "@/lib/types";

// İstasyon ekranında gösterilen en fazla teslim edilmiş fiş sayısı
const DELIVERED_LIMIT = 12;

// Fiş kalemleri; masa numarası ekranlarda gösterilen sıra numarasıdır (tabloların id sırası)
const TICKET_ITEMS = `SELECT oi.id, oi.quantity, oi.batch_id, oi.station_id, oi.prep_status, oi.delivered_at, p.name, b.created_at,
                             s.name AS station_name, (SELECT count(*) FROM tables t WHERE t.id <= o.table_id) AS table_no
                      FROM order_items oi
                      JOIN products p ON p.id = oi.product_id
                      JOIN order_batches b ON b.id = oi.batch_id
                      JOIN orders o ON o.id = oi.order_id
                      JOIN stations s ON s.id = oi.station_id`;

// Sorgular ilk çağrıda hazırlanır; `next build` sırasında veritabanı açılmaz
const statements = (db = getDb()) => ({
    tables: db.prepare("SELECT id, name, status FROM tables ORDER BY id"),
    categories: db.prepare("SELECT id, name, station_id FROM categories ORDER BY id"),
    products: db.prepare("SELECT id, name, price, category, station_id FROM products WHERE active = 1 ORDER BY id"),
    stations: db.prepare("SELECT id, name, print_mode, printer_name FROM stations ORDER BY id"),
    station: db.prepare("SELECT id, name, print_mode, printer_name FROM stations WHERE id = ?"),
    activeOrder: db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'"),
    orderItems: db.prepare(`SELECT oi.id, oi.quantity, oi.price, oi.prep_status, p.name, s.name AS station_name FROM order_items oi
                            JOIN products p ON oi.product_id = p.id LEFT JOIN stations s ON s.id = oi.station_id
                            WHERE oi.order_id = ? ORDER BY oi.id`),
    orderNotes: db.prepare("SELECT id, note, created_at FROM order_notes WHERE order_id = ? ORDER BY id"),
    settings: db.prepare("SELECT key, value FROM settings"),
    stationItems: db.prepare(`${TICKET_ITEMS}
                              WHERE oi.station_id = @station AND (oi.prep_status IN ('pending', 'ready') OR (oi.prep_status = 'delivered' AND oi.batch_id IN (
                                  SELECT batch_id FROM order_items WHERE station_id = @station AND prep_status = 'delivered'
                                  GROUP BY batch_id ORDER BY max(delivered_at) DESC, batch_id DESC LIMIT ${DELIVERED_LIMIT})))
                              ORDER BY oi.batch_id, oi.id`),
    // Garson ekranındaki bildirimler: tüm istasyonlarda hazır bekleyen kalemler
    readyItems: db.prepare(`${TICKET_ITEMS} WHERE oi.prep_status = 'ready' ORDER BY oi.batch_id, oi.station_id, oi.id`),
    ticketItems: db.prepare(`${TICKET_ITEMS} WHERE oi.station_id = ? AND oi.batch_id = ? ORDER BY oi.id`),
    lastTicket: db.prepare("SELECT max(batch_id) AS batch FROM order_items WHERE station_id = ?"),
    batchNotes: db.prepare("SELECT note FROM order_notes WHERE batch_id = ? ORDER BY id"),
    // Gün sınırı kasa bilgisayarının saat dilimine göre belirlenir (SQLite saatleri UTC saklar)
    saleSummary: db.prepare(`SELECT count(*) AS count, coalesce(sum(total), 0) AS total, coalesce(sum(paid_amount), 0) AS paid,
                                    coalesce(sum(CASE WHEN payment_method = 'cash' THEN paid_amount END), 0) AS cash,
                                    coalesce(sum(CASE WHEN payment_method = 'card' THEN paid_amount END), 0) AS card
                             FROM sales WHERE date(closed_at, 'localtime') = ?`),
    productSales: db.prepare(`SELECT si.product_name AS name, si.category, sum(si.quantity) AS quantity, sum(si.quantity * si.price) AS revenue
                              FROM sale_items si JOIN sales s ON s.id = si.sale_id
                              WHERE date(s.closed_at, 'localtime') = ?
                              GROUP BY si.product_name, si.category ORDER BY revenue DESC, name`),
    sales: db.prepare(`SELECT s.id, s.table_no, s.total, s.paid_amount, s.payment_method, s.closed_at,
                              (SELECT coalesce(sum(quantity), 0) FROM sale_items WHERE sale_id = s.id) AS item_count
                       FROM sales s WHERE date(s.closed_at, 'localtime') = ? ORDER BY s.id DESC`),
    today: db.prepare("SELECT date('now', 'localtime') AS today"),
});
let cached: ReturnType<typeof statements> | null = null;
const q = () => (cached ??= statements());

export async function getTables() {
    return q().tables.all() as Table[];
}

export async function getCategories() {
    return q().categories.all() as Category[];
}

export async function getProducts() {
    return q().products.all() as Product[];
}

export async function getStations() {
    return q().stations.all() as Station[];
}

export async function getStation(id: number) {
    if (!Number.isInteger(id)) return null;
    return (q().station.get(id) as Station | undefined) ?? null;
}

export async function getTableOrder(tableId: number): Promise<TableOrder | null> {
    if (!Number.isInteger(tableId)) return null;
    const order = q().activeOrder.get(tableId) as { id: number } | undefined;
    if (!order) return null;
    return { id: order.id, items: q().orderItems.all(order.id) as TableOrder["items"], notes: q().orderNotes.all(order.id) as TableOrder["notes"] };
}

type TicketItemRow = {
    id: number; quantity: number; batch_id: number; station_id: number; prep_status: "pending" | "ready" | "delivered";
    delivered_at: string | null; name: string; created_at: string; station_name: string; table_no: number;
};

/** Kalemleri fişlere (sipariş + istasyon) toplar. */
function toTickets(rows: TicketItemRow[]): StationTicket[] {
    const tickets = new Map<string, StationTicket>();
    for (const r of rows) {
        const key = `${r.batch_id}|${r.station_id}`;
        let ticket = tickets.get(key);
        if (!ticket) {
            const notes = (q().batchNotes.all(r.batch_id) as { note: string }[]).map((n) => n.note);
            ticket = { batchId: r.batch_id, stationId: r.station_id, stationName: r.station_name, tableNo: r.table_no, createdAt: r.created_at, deliveredAt: null, notes, items: [] };
            tickets.set(key, ticket);
        }
        if (r.delivered_at && (!ticket.deliveredAt || r.delivered_at > ticket.deliveredAt)) ticket.deliveredAt = r.delivered_at;
        ticket.items.push({ id: r.id, name: r.name, quantity: r.quantity });
    }
    return [...tickets.values()];
}

export type StationTickets = { pending: StationTicket[]; ready: StationTicket[]; delivered: StationTicket[] };

/** İstasyonun hazırlanan ve hazır fişleri (eskiden yeniye) ve son teslim edilenler (yeniden eskiye). */
export async function getStationTickets(stationId: number): Promise<StationTickets> {
    if (!Number.isInteger(stationId)) return { pending: [], ready: [], delivered: [] };
    const rows = q().stationItems.all({ station: stationId }) as TicketItemRow[];
    const byStatus = (status: TicketItemRow["prep_status"]) => toTickets(rows.filter((r) => r.prep_status === status));
    const delivered = byStatus("delivered").sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? "") || b.batchId - a.batchId);
    return { pending: byStatus("pending"), ready: byStatus("ready"), delivered };
}

/** Bir fişin (sipariş + istasyon) tüm kalemleri, hazırlık durumundan bağımsız; yazdırmak için. */
export async function getStationTicket(stationId: number, batchId: number): Promise<StationTicket | null> {
    if (!Number.isInteger(stationId) || !Number.isInteger(batchId)) return null;
    return toTickets(q().ticketItems.all(stationId, batchId) as TicketItemRow[])[0] ?? null;
}

/** İstasyona düşen en son fişin numarası (test baskısı için). */
export async function getLastTicketBatch(stationId: number): Promise<number | null> {
    if (!Number.isInteger(stationId)) return null;
    return (q().lastTicket.get(stationId) as { batch: number | null }).batch;
}

/** Garsonun alması gereken, istasyonlarda hazır bekleyen fişler. */
export async function getReadyTickets(): Promise<StationTicket[]> {
    return toTickets(q().readyItems.all() as TicketItemRow[]);
}

/** Kasa bilgisayarının saatine göre bugünün tarihi (YYYY-AA-GG). */
export async function getToday() {
    return (q().today.get() as { today: string }).today;
}

/** Seçilen günün (YYYY-AA-GG, kasa saatine göre) satış özeti, ürün bazlı satışları ve kapatılan adisyonları. */
export async function getDailySales(date?: string): Promise<DailySales> {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : await getToday();
    return {
        date: day,
        summary: q().saleSummary.get(day) as SaleSummary,
        products: q().productSales.all(day) as ProductSale[],
        sales: q().sales.all(day) as Sale[],
    };
}

export async function getSettings(): Promise<Settings> {
    const rows = q().settings.all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
