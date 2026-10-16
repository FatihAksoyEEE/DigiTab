"use server";

// Yalnızca okuma işlemleri. Veriyi değiştiren her şey server.ts'deki socket olaylarından geçer.
import db from "@/lib/db";
import type { Category, Product, Settings, Table, TableOrder } from "@/lib/types";

const q = {
    tables: db.prepare("SELECT id, name, status FROM tables ORDER BY id"),
    categories: db.prepare("SELECT id, name FROM categories ORDER BY id"),
    products: db.prepare("SELECT id, name, price, category FROM products WHERE active = 1 ORDER BY id"),
    activeOrder: db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'"),
    orderItems: db.prepare(`SELECT oi.id, oi.quantity, oi.price, p.name FROM order_items oi
                            JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`),
    orderNotes: db.prepare("SELECT id, note, created_at FROM order_notes WHERE order_id = ? ORDER BY id"),
    settings: db.prepare("SELECT key, value FROM settings"),
};

export async function getTables() {
    return q.tables.all() as Table[];
}

export async function getCategories() {
    return q.categories.all() as Category[];
}

export async function getProducts() {
    return q.products.all() as Product[];
}

export async function getTableOrder(tableId: number): Promise<TableOrder | null> {
    if (!Number.isInteger(tableId)) return null;
    const order = q.activeOrder.get(tableId) as { id: number } | undefined;
    if (!order) return null;
    return { id: order.id, items: q.orderItems.all(order.id) as TableOrder["items"], notes: q.orderNotes.all(order.id) as TableOrder["notes"] };
}

export async function getSettings(): Promise<Settings> {
    const rows = q.settings.all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
