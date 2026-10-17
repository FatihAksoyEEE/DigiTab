import { createServer, IncomingMessage } from "http";
import next from "next";
import { Server } from "socket.io";
import db, { backupDatabase } from "./src/lib/db";
import { getLanAddresses, isLocalAddress } from "./src/lib/network";
import type { Result } from "./src/lib/types";

const dev = process.env.NODE_ENV !== "production";
const PORT = Number(process.env.PORT) || 3000;
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Kasa paneli yalnızca kasa bilgisayarından açılabilir; ağdaki cihazlar garson ekranına yönlenir
const ADMIN_PATH = /^\/dashboard(\/|$)/;
const pathOf = (url = "") => {
    try { return decodeURIComponent(url.split("?")[0]).replace(/\/{2,}/g, "/").toLowerCase(); } catch { return ""; }
};

/** Kullanıcıya gösterilebilecek doğrulama hatası. */
class UserError extends Error {}

const toId = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
const toText = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const must = <T>(value: T | null, message: string): T => {
    if (value === null) throw new UserError(message);
    return value;
};

// Başka sitelerden açılan WebSocket bağlantılarını reddet (yalnızca aynı origin)
const isSameOrigin = (req: IncomingMessage) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
};

const q = {
    tableExists: db.prepare("SELECT 1 FROM tables WHERE id = ?"),
    tableCount: db.prepare("SELECT count(*) AS count FROM tables"),
    lastTables: db.prepare("SELECT id FROM tables ORDER BY id DESC LIMIT ?"),
    insertTable: db.prepare("INSERT INTO tables (name) VALUES (?)"),
    deleteTable: db.prepare("DELETE FROM tables WHERE id = ?"),
    setTableStatus: db.prepare("UPDATE tables SET status = ? WHERE id = ?"),

    activeOrder: db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'"),
    insertOrder: db.prepare("INSERT INTO orders (table_id, status, waiter_name) VALUES (?, 'active', ?)"),
    closeOrders: db.prepare("UPDATE orders SET status = 'closed' WHERE table_id = ? AND status = 'active'"),
    deleteTableOrders: db.prepare("DELETE FROM orders WHERE table_id = ?"),
    deleteTableItems: db.prepare("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)"),
    deleteTableNotes: db.prepare("DELETE FROM order_notes WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)"),

    insertItem: db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)"),
    insertNote: db.prepare("INSERT INTO order_notes (order_id, note, waiter_name) VALUES (?, ?, ?)"),
    // Kalem yalnızca belirtilen masanın açık siparişine aitse bulunur
    activeItem: db.prepare(`SELECT oi.quantity, oi.order_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
                            WHERE oi.id = ? AND o.table_id = ? AND o.status = 'active'`),
    setItemQuantity: db.prepare("UPDATE order_items SET quantity = ? WHERE id = ?"),
    deleteItem: db.prepare("DELETE FROM order_items WHERE id = ?"),
    orderItemCount: db.prepare("SELECT count(*) AS count FROM order_items WHERE order_id = ?"),
    closeOrder: db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?"),

    productPrice: db.prepare("SELECT price FROM products WHERE id = ? AND active = 1"),
    insertProduct: db.prepare("INSERT INTO products (name, price, category) VALUES (?, ?, ?)"),
    productUsed: db.prepare("SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1"),
    archiveProduct: db.prepare("UPDATE products SET active = 0 WHERE id = ?"),
    deleteProduct: db.prepare("DELETE FROM products WHERE id = ?"),

    categoryExists: db.prepare("SELECT 1 FROM categories WHERE name = ?"),
    categoryById: db.prepare("SELECT name FROM categories WHERE id = ?"),
    categoryHasProducts: db.prepare("SELECT 1 FROM products WHERE category = ? AND active = 1 LIMIT 1"),
    insertCategory: db.prepare("INSERT INTO categories (name) VALUES (?)"),
    deleteCategory: db.prepare("DELETE FROM categories WHERE id = ?"),

    upsertSetting: db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"),
};

app.prepare().then(() => {
    const server = createServer((req, res) => {
        if (ADMIN_PATH.test(pathOf(req.url)) && !isLocalAddress(req.socket.remoteAddress)) {
            res.writeHead(302, { Location: "/waiter" }).end();
            return;
        }
        handle(req, res);
    });

    const io = new Server(server, {
        allowRequest: (req, callback) => callback(null, isSameOrigin(req)),
        maxHttpBufferSize: 64 * 1024,
    });

    io.on("connection", (socket) => {
        const isCashier = isLocalAddress(socket.handshake.address);

        /** Olay işleyicisini doğrulama, yetki ve hata yönetimiyle kaydeder. */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const on = (event: string, fn: (data: any) => void | Promise<void>, { cashierOnly = true } = {}) => {
            socket.on(event, async (data: unknown, ack?: (res: Result) => void) => {
                const reply = (res: Result) => typeof ack === "function" && ack(res);
                if (cashierOnly && !isCashier) return reply({ ok: false, error: "Bu işlem yalnızca kasa bilgisayarından yapılabilir." });
                try {
                    await fn(data && typeof data === "object" ? data : {});
                    reply({ ok: true });
                } catch (err) {
                    if (!(err instanceof UserError)) console.error(`${event} başarısız:`, err);
                    reply({ ok: false, error: err instanceof UserError ? err.message : "İşlem başarısız oldu." });
                }
            });
        };

        const validTable = (v: unknown) => {
            const id = must(toId(v), "Geçersiz masa.");
            if (!q.tableExists.get(id)) throw new UserError("Masa bulunamadı.");
            return id;
        };

        // --- Garson ---

        on("place_order", (data) => {
            const tableId = validTable(data.tableId);
            if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 100) throw new UserError("Sipariş boş.");

            // Fiyatlar istemciden değil, menüden alınır
            const items = data.items.map((item: { id?: unknown; quantity?: unknown }) => {
                const productId = must(toId(item?.id), "Geçersiz ürün.");
                const quantity = must(toId(item?.quantity), "Geçersiz adet.");
                if (quantity > 99) throw new UserError("Geçersiz adet.");
                const product = q.productPrice.get(productId) as { price: number } | undefined;
                if (!product) throw new UserError("Ürün menüde bulunamadı.");
                return { productId, quantity, price: product.price };
            });
            const waiterName = toText(data.waiterName, 50) ?? "Garson";
            const note = toText(data.note, 300);

            db.transaction(() => {
                let orderId = (q.activeOrder.get(tableId) as { id: number } | undefined)?.id as number | bigint | undefined;
                if (!orderId) {
                    orderId = q.insertOrder.run(tableId, waiterName).lastInsertRowid;
                    q.setTableStatus.run("occupied", tableId);
                }
                for (const i of items) q.insertItem.run(orderId, i.productId, i.quantity, i.price);
                if (note) q.insertNote.run(orderId, note, waiterName);
            })();

            io.emit("table_update", { id: tableId, status: "occupied" });
            io.emit("new_order_notification", { tableId });
        }, { cashierOnly: false });

        // --- Kasa: siparişler ---

        const changeItem = (data: { tableId?: unknown; itemId?: unknown }, delta: number | null) => {
            const tableId = validTable(data.tableId);
            const itemId = must(toId(data.itemId), "Geçersiz ürün.");
            const item = q.activeItem.get(itemId, tableId) as { quantity: number; order_id: number } | undefined;
            if (!item) throw new UserError("Ürün bu masanın siparişinde bulunamadı.");

            const quantity = delta === null ? 0 : item.quantity + delta;
            let tableFreed = false;
            db.transaction(() => {
                if (quantity <= 0) q.deleteItem.run(itemId);
                else q.setItemQuantity.run(quantity, itemId);
                // Son ürün de kaldırıldıysa masayı otomatik kapat
                if ((q.orderItemCount.get(item.order_id) as { count: number }).count === 0) {
                    q.closeOrder.run(item.order_id);
                    q.setTableStatus.run("free", tableId);
                    tableFreed = true;
                }
            })();

            if (tableFreed) io.emit("table_update", { id: tableId, status: "free" });
            io.emit("new_order_notification", { tableId });
        };

        on("remove_order_item", (data) => changeItem(data, null));
        on("update_order_item_quantity", (data) => {
            if (data.change !== 1 && data.change !== -1) throw new UserError("Geçersiz değişiklik.");
            changeItem(data, data.change);
        });

        on("close_table", (data) => {
            const tableId = validTable(data.tableId);
            db.transaction(() => {
                q.setTableStatus.run("free", tableId);
                q.closeOrders.run(tableId);
            })();
            io.emit("table_update", { id: tableId, status: "free" });
        });

        // --- Kasa: ayarlar ---

        on("update_table_count", (data) => {
            const count = must(toId(data.count), "Masa sayısı 1-100 arasında olmalı.");
            if (count > 100) throw new UserError("Masa sayısı 1-100 arasında olmalı.");

            db.transaction(() => {
                const current = (q.tableCount.get() as { count: number }).count;
                for (let i = current + 1; i <= count; i++) q.insertTable.run(`Table ${i}`);
                if (count < current) {
                    for (const { id } of q.lastTables.all(current - count) as { id: number }[]) {
                        q.deleteTableItems.run(id);
                        q.deleteTableNotes.run(id);
                        q.deleteTableOrders.run(id);
                        q.deleteTable.run(id);
                    }
                }
            })();
            io.emit("tables_refresh");
        });

        on("update_settings", (data) => {
            const restaurantName = must(toText(data.restaurant_name, 60), "Restoran adı boş olamaz.");
            const managerName = must(toText(data.manager_name, 60), "Yönetici adı boş olamaz.");
            db.transaction(() => {
                q.upsertSetting.run("restaurant_name", restaurantName);
                q.upsertSetting.run("manager_name", managerName);
            })();
            io.emit("settings_refresh", { restaurant_name: restaurantName, manager_name: managerName });
        });

        on("backup_database", async () => {
            await backupDatabase();
        });

        // --- Kasa: menü ---

        on("add_category", (data) => {
            const name = must(toText(data.name, 40), "Kategori adı boş olamaz.");
            if (q.categoryExists.get(name)) throw new UserError("Bu kategori zaten var.");
            q.insertCategory.run(name);
            io.emit("menu_refresh");
        });

        on("delete_category", (data) => {
            const id = must(toId(data.id), "Geçersiz kategori.");
            const category = q.categoryById.get(id) as { name: string } | undefined;
            if (!category) throw new UserError("Kategori bulunamadı.");
            if (q.categoryHasProducts.get(category.name)) throw new UserError("Önce bu kategorideki ürünleri silin.");
            q.deleteCategory.run(id);
            io.emit("menu_refresh");
        });

        on("add_product", (data) => {
            const name = must(toText(data.name, 60), "Ürün adı boş olamaz.");
            const price = Number(data.price);
            if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new UserError("Geçerli bir fiyat girin.");
            const category = must(toText(data.categoryName, 40), "Kategori seçin.");
            if (!q.categoryExists.get(category)) throw new UserError("Kategori bulunamadı.");
            q.insertProduct.run(name, Math.round(price * 100) / 100, category);
            io.emit("menu_refresh");
        });

        on("delete_product", (data) => {
            const id = must(toId(data.id), "Geçersiz ürün.");
            // Geçmiş siparişlerde kullanılan ürün arşivlenir, böylece eski adisyonlar bozulmaz
            if (q.productUsed.get(id)) q.archiveProduct.run(id);
            else q.deleteProduct.run(id);
            io.emit("menu_refresh");
        });
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
        console.error(err.code === "EADDRINUSE" ? `Port ${PORT} kullanımda. Başka bir DigiTab penceresi açık olabilir.` : err);
        process.exit(1);
    });

    server.listen(PORT, "0.0.0.0", () => {
        console.log(`> Hazır: http://localhost:${PORT}`);
        const addresses = getLanAddresses();
        if (addresses.length > 0) {
            console.log("\n📱 Garson telefonları için yerel ağ adresleri:");
            addresses.forEach((addr) => console.log(`   http://${addr}:${PORT}/waiter`));
        }
    });
});

// Kapanışta WAL dosyasını veritabanına işle
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        db.close();
        process.exit(0);
    });
}
