import { createServer, IncomingMessage } from "http";
import next from "next";
import { Server, type Socket } from "socket.io";
import { backupDatabase, getDb } from "./src/lib/db";
import { getLanAddresses, isLocalAddress } from "./src/lib/network";
import type { Result } from "./src/lib/types";
import { sanitizeTemplate } from "./src/lib/receipt";

const db = getDb();
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
    tableNo: db.prepare("SELECT count(*) AS no FROM tables WHERE id <= ?"),
    // Aynı ürün farklı siparişlerde ayrı satır olabilir; satışta tek satıra toplanır
    orderSaleItems: db.prepare(`SELECT oi.product_id, p.name, p.category, sum(oi.quantity) AS quantity, oi.price
                                FROM order_items oi JOIN products p ON p.id = oi.product_id
                                WHERE oi.order_id = ? GROUP BY oi.product_id, oi.price ORDER BY min(oi.id)`),
    insertSale: db.prepare("INSERT INTO sales (order_id, table_no, total, paid_amount, payment_method) VALUES (?, ?, ?, ?, ?)"),
    insertSaleItem: db.prepare("INSERT INTO sale_items (sale_id, product_id, product_name, category, quantity, price) VALUES (?, ?, ?, ?, ?, ?)"),
    deleteTableOrders: db.prepare("DELETE FROM orders WHERE table_id = ?"),
    deleteTableItems: db.prepare("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)"),
    deleteTableNotes: db.prepare("DELETE FROM order_notes WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)"),
    deleteTableBatches: db.prepare("DELETE FROM order_batches WHERE order_id IN (SELECT id FROM orders WHERE table_id = ?)"),
    tableStations: db.prepare(`SELECT DISTINCT station_id FROM order_items WHERE station_id IS NOT NULL
                               AND order_id IN (SELECT id FROM orders WHERE table_id = ?)`),

    insertBatch: db.prepare("INSERT INTO order_batches (order_id) VALUES (?)"),
    insertItem: db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, price, batch_id, station_id, prep_status)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`),
    insertNote: db.prepare("INSERT INTO order_notes (order_id, note, waiter_name, batch_id) VALUES (?, ?, ?, ?)"),
    // Kalem yalnızca belirtilen masanın açık siparişine aitse bulunur
    activeItem: db.prepare(`SELECT oi.quantity, oi.order_id, oi.product_id, oi.price, oi.batch_id, oi.station_id, oi.prep_status
                            FROM order_items oi JOIN orders o ON o.id = oi.order_id
                            WHERE oi.id = ? AND o.table_id = ? AND o.status = 'active'`),
    setItemQuantity: db.prepare("UPDATE order_items SET quantity = ? WHERE id = ?"),
    deleteItem: db.prepare("DELETE FROM order_items WHERE id = ?"),
    orderItemCount: db.prepare("SELECT count(*) AS count FROM order_items WHERE order_id = ?"),
    closeOrder: db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?"),

    // Ürünün istasyonu yoksa kategorisinin istasyonu kullanılır
    productForOrder: db.prepare(`SELECT p.price, COALESCE(p.station_id, c.station_id) AS station_id FROM products p
                                 LEFT JOIN categories c ON c.name = p.category WHERE p.id = ? AND p.active = 1`),
    insertProduct: db.prepare("INSERT INTO products (name, price, category, station_id) VALUES (?, ?, ?, ?)"),
    setProductStation: db.prepare("UPDATE products SET station_id = ? WHERE id = ? AND active = 1"),
    productUsed: db.prepare("SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1"),
    archiveProduct: db.prepare("UPDATE products SET active = 0 WHERE id = ?"),
    deleteProduct: db.prepare("DELETE FROM products WHERE id = ?"),

    categoryExists: db.prepare("SELECT 1 FROM categories WHERE name = ?"),
    categoryById: db.prepare("SELECT name FROM categories WHERE id = ?"),
    categoryHasProducts: db.prepare("SELECT 1 FROM products WHERE category = ? AND active = 1 LIMIT 1"),
    insertCategory: db.prepare("INSERT INTO categories (name) VALUES (?)"),
    deleteCategory: db.prepare("DELETE FROM categories WHERE id = ?"),
    setCategoryStation: db.prepare("UPDATE categories SET station_id = ? WHERE id = ?"),

    stationExists: db.prepare("SELECT 1 FROM stations WHERE id = ?"),
    stationPrint: db.prepare("SELECT print_mode, printer_name FROM stations WHERE id = ?"),
    setStationPrint: db.prepare("UPDATE stations SET print_mode = ?, printer_name = ? WHERE id = ?"),
    ticketExists: db.prepare("SELECT 1 FROM order_items WHERE station_id = ? AND batch_id = ? LIMIT 1"),
    lastStationBatch: db.prepare("SELECT max(batch_id) AS batch FROM order_items WHERE station_id = ?"),
    stationNameExists: db.prepare("SELECT 1 FROM stations WHERE name = ?"),
    insertStation: db.prepare("INSERT INTO stations (name) VALUES (?)"),
    stationHasPending: db.prepare("SELECT 1 FROM order_items WHERE station_id = ? AND prep_status IN ('pending', 'ready') LIMIT 1"),
    unlinkStationCategories: db.prepare("UPDATE categories SET station_id = NULL WHERE station_id = ?"),
    unlinkStationProducts: db.prepare("UPDATE products SET station_id = NULL WHERE station_id = ?"),
    unlinkStationItems: db.prepare("UPDATE order_items SET station_id = NULL WHERE station_id = ?"),
    deleteStation: db.prepare("DELETE FROM stations WHERE id = ?"),
    batchTable: db.prepare("SELECT o.table_id FROM order_batches b JOIN orders o ON o.id = b.order_id WHERE b.id = ?"),
    markTicketReady: db.prepare("UPDATE order_items SET prep_status = 'ready' WHERE batch_id = ? AND station_id = ? AND prep_status = 'pending'"),
    deliverTicket: db.prepare(`UPDATE order_items SET prep_status = 'delivered', delivered_at = CURRENT_TIMESTAMP
                               WHERE batch_id = ? AND station_id = ? AND prep_status IN ('pending', 'ready')`),

    upsertSetting: db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"),
    deleteSetting: db.prepare("DELETE FROM settings WHERE key = ?"),
    getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
};

/**
 * Kasa yazdırma ajanı: Electron ana süreci sunucuya socket istemcisi olarak bağlanır, yazıcı listesini bildirir
 * ve gelen fişleri işletim sisteminin yazıcı sürücüsüyle diyalogsuz basar. Tarayıcıdan açılan kasada ajan yoktur.
 */
let printAgent: Socket | null = null;
const NO_AGENT = "Kasa uygulaması açık değil. Kasa yazıcısına yazdırma yalnızca DigiTab masaüstü uygulamasında çalışır.";

/** Ajana yazdırma işi gönderir; ajanın verdiği hatayı kullanıcıya iletir. */
async function printViaAgent(path: string, printer: string) {
    if (!printAgent) throw new UserError(NO_AGENT);
    let res: { ok: boolean; error?: string };
    try {
        res = await printAgent.timeout(20_000).emitWithAck("print_job", { path, printer });
    } catch {
        throw new UserError("Yazıcı yanıt vermedi. Yazıcının açık ve bağlı olduğundan emin olun.");
    }
    if (!res?.ok) throw new UserError(`Yazdırılamadı: ${res?.error || "bilinmeyen hata"}`);
}

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
        const on = (event: string, fn: (data: any) => unknown, { cashierOnly = true } = {}) => {
            socket.on(event, async (...args: unknown[]) => {
                // Veri gönderilmeden yapılan isteklerde yanıt fonksiyonu ilk parametre olarak gelir
                const ack = typeof args[args.length - 1] === "function" ? args.pop() as (res: Result) => void : undefined;
                const data = args[0];
                const reply = (res: Result) => ack?.(res);
                if (cashierOnly && !isCashier) return reply({ ok: false, error: "Bu işlem yalnızca kasa bilgisayarından yapılabilir." });
                try {
                    const result = await fn(data && typeof data === "object" ? data : {});
                    // Döndürülen veri (ör. yazıcı listesi) istemciye iletilir
                    reply(result === undefined || typeof result === "boolean" ? { ok: true } : { ok: true, data: result });
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

        const validStation = (v: unknown) => {
            const id = must(toId(v), "Geçersiz istasyon.");
            if (!q.stationExists.get(id)) throw new UserError("İstasyon bulunamadı.");
            return id;
        };
        /** Boş değer istasyon atamasını kaldırır (ürün için: kategorinin istasyonunu kullan). */
        const optionalStation = (v: unknown) => (v === null || v === undefined || v === "" ? null : validStation(v));

        // --- Garson ---

        on("place_order", (data) => {
            const tableId = validTable(data.tableId);
            if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 100) throw new UserError("Sipariş boş.");

            // Fiyatlar istemciden değil, menüden alınır
            const items = data.items.map((item: { id?: unknown; quantity?: unknown }) => {
                const productId = must(toId(item?.id), "Geçersiz ürün.");
                const quantity = must(toId(item?.quantity), "Geçersiz adet.");
                if (quantity > 99) throw new UserError("Geçersiz adet.");
                const product = q.productForOrder.get(productId) as { price: number; station_id: number | null } | undefined;
                if (!product) throw new UserError("Ürün menüde bulunamadı.");
                return { productId, quantity, price: product.price, stationId: product.station_id };
            });
            const waiterName = toText(data.waiterName, 50) ?? "Garson";
            const note = toText(data.note, 300);

            db.transaction(() => {
                let orderId = (q.activeOrder.get(tableId) as { id: number } | undefined)?.id as number | bigint | undefined;
                if (!orderId) {
                    orderId = q.insertOrder.run(tableId, waiterName).lastInsertRowid;
                    q.setTableStatus.run("occupied", tableId);
                }
                const batchId = q.insertBatch.run(orderId).lastInsertRowid;
                for (const i of items) {
                    q.insertItem.run(orderId, i.productId, i.quantity, i.price, batchId, i.stationId, i.stationId ? "pending" : null);
                }
                if (note) q.insertNote.run(orderId, note, waiterName, batchId);
            })();

            io.emit("table_update", { id: tableId, status: "occupied" });
            io.emit("new_order_notification", { tableId });
            const stationIds = new Set(items.map((i: { stationId: number | null }) => i.stationId).filter(Boolean));
            for (const stationId of stationIds) io.emit("station_update", { stationId, newTicket: true });
        }, { cashierOnly: false });

        // --- Kasa: siparişler ---

        const changeItem = (data: { tableId?: unknown; itemId?: unknown }, delta: number | null) => {
            const tableId = validTable(data.tableId);
            const itemId = must(toId(data.itemId), "Geçersiz ürün.");
            const item = q.activeItem.get(itemId, tableId) as {
                quantity: number; order_id: number; product_id: number; price: number;
                batch_id: number | null; station_id: number | null; prep_status: string | null;
            } | undefined;
            if (!item) throw new UserError("Ürün bu masanın siparişinde bulunamadı.");

            const quantity = delta === null ? 0 : item.quantity + delta;
            let tableFreed = false;
            db.transaction(() => {
                // Hazırlanmış kaleme eklenen adet istasyonda yeniden hazırlanmalı; ayrı bir kalem olarak açılır
                if (delta === 1 && (item.prep_status === "ready" || item.prep_status === "delivered")) {
                    q.insertItem.run(item.order_id, item.product_id, 1, item.price, item.batch_id, item.station_id, "pending");
                } else if (quantity <= 0) q.deleteItem.run(itemId);
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
            if (item.station_id) io.emit("station_update", { stationId: item.station_id });
            if (item.prep_status === "ready") io.emit("ready_update");
        };

        on("remove_order_item", (data) => changeItem(data, null));
        on("update_order_item_quantity", (data) => {
            if (data.change !== 1 && data.change !== -1) throw new UserError("Geçersiz değişiklik.");
            changeItem(data, data.change);
        });

        // Masa kapatılırken adisyon satış defterine yazılır; alınan tutar indirim vb. için adisyon toplamından farklı olabilir
        on("close_table", (data) => {
            const tableId = validTable(data.tableId);
            const method = data.paymentMethod === "card" ? "card" : data.paymentMethod === "cash" ? "cash" : null;
            if (!method) throw new UserError("Ödeme türünü seçin.");
            const paidInput = data.paidAmount === undefined || data.paidAmount === "" ? null : Number(data.paidAmount);
            if (paidInput !== null && (!Number.isFinite(paidInput) || paidInput < 0 || paidInput > 1_000_000)) throw new UserError("Geçerli bir tutar girin.");

            let sold = false;
            db.transaction(() => {
                const order = q.activeOrder.get(tableId) as { id: number } | undefined;
                const items = order ? q.orderSaleItems.all(order.id) as { product_id: number; name: string; category: string | null; quantity: number; price: number }[] : [];
                if (order && items.length > 0) {
                    const total = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
                    const paid = paidInput === null ? total : Math.round(paidInput * 100) / 100;
                    const tableNo = (q.tableNo.get(tableId) as { no: number }).no;
                    const saleId = q.insertSale.run(order.id, tableNo, total, paid, method).lastInsertRowid;
                    for (const i of items) q.insertSaleItem.run(saleId, i.product_id, i.name, i.category, i.quantity, i.price);
                    sold = true;
                }
                q.setTableStatus.run("free", tableId);
                q.closeOrders.run(tableId);
            })();
            io.emit("table_update", { id: tableId, status: "free" });
            if (sold) io.emit("sales_update");
        });

        // --- Kasa: ayarlar ---

        on("update_table_count", (data) => {
            const count = must(toId(data.count), "Masa sayısı 1-100 arasında olmalı.");
            if (count > 100) throw new UserError("Masa sayısı 1-100 arasında olmalı.");

            const affectedStations = new Set<number>();
            db.transaction(() => {
                const current = (q.tableCount.get() as { count: number }).count;
                for (let i = current + 1; i <= count; i++) q.insertTable.run(`Table ${i}`);
                if (count < current) {
                    for (const { id } of q.lastTables.all(current - count) as { id: number }[]) {
                        for (const { station_id } of q.tableStations.all(id) as { station_id: number }[]) affectedStations.add(station_id);
                        q.deleteTableItems.run(id);
                        q.deleteTableNotes.run(id);
                        q.deleteTableBatches.run(id);
                        q.deleteTableOrders.run(id);
                        q.deleteTable.run(id);
                    }
                }
            })();
            io.emit("tables_refresh");
            for (const stationId of affectedStations) io.emit("station_update", { stationId });
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
            q.insertProduct.run(name, Math.round(price * 100) / 100, category, optionalStation(data.stationId));
            io.emit("menu_refresh");
        });

        on("set_product_station", (data) => {
            const id = must(toId(data.id), "Geçersiz ürün.");
            q.setProductStation.run(optionalStation(data.stationId), id);
            io.emit("menu_refresh");
        });

        on("set_category_station", (data) => {
            const id = must(toId(data.id), "Geçersiz kategori.");
            if (!q.categoryById.get(id)) throw new UserError("Kategori bulunamadı.");
            q.setCategoryStation.run(optionalStation(data.stationId), id);
            io.emit("menu_refresh");
        });

        // --- Kasa: istasyonlar ---

        on("add_station", (data) => {
            const name = must(toText(data.name, 40), "İstasyon adı boş olamaz.");
            if (q.stationNameExists.get(name)) throw new UserError("Bu istasyon zaten var.");
            q.insertStation.run(name);
            io.emit("stations_refresh");
        });

        on("delete_station", (data) => {
            const id = validStation(data.id);
            if (q.stationHasPending.get(id)) throw new UserError("Bu istasyonda hazırlanan siparişler var. Önce teslim edin.");
            db.transaction(() => {
                q.unlinkStationCategories.run(id);
                q.unlinkStationProducts.run(id);
                q.unlinkStationItems.run(id);
                q.deleteStation.run(id);
            })();
            io.emit("stations_refresh");
            io.emit("menu_refresh");
            io.emit("ready_update");
        });

        // --- İstasyon ekranı (ağdaki tabletlerden kullanılabilir) ---

        /** İstasyon fişinin durumunu değiştirir ve ilgili ekranları günceller. */
        const updateTicket = (data: { stationId?: unknown; batchId?: unknown }, statement: typeof q.deliverTicket) => {
            const stationId = validStation(data.stationId);
            const batchId = must(toId(data.batchId), "Geçersiz fiş.");
            const batch = q.batchTable.get(batchId) as { table_id: number } | undefined;
            if (!batch) throw new UserError("Fiş bulunamadı.");
            const changed = statement.run(batchId, stationId).changes > 0;
            if (!changed) return false;
            io.emit("station_update", { stationId });
            io.emit("new_order_notification", { tableId: batch.table_id });
            return true;
        };

        // --- Yazdırma ---

        on("register_print_agent", () => {
            printAgent = socket;
            socket.on("disconnect", () => { if (printAgent === socket) printAgent = null; });
        });

        on("list_printers", async () => {
            if (!printAgent) return { agent: false, printers: [] };
            try {
                const printers = await printAgent.timeout(5000).emitWithAck("list_printers");
                return { agent: true, printers: Array.isArray(printers) ? printers : [] };
            } catch {
                return { agent: false, printers: [] };
            }
        });

        on("set_station_printer", (data) => {
            const id = validStation(data.id);
            const mode = ["none", "cashier", "device"].includes(data.mode) ? data.mode as string : null;
            if (!mode) throw new UserError("Geçersiz yazdırma ayarı.");
            // Kasa modunda yazıcı boşsa Ayarlar > Fiş'teki varsayılan kasa yazıcısı kullanılır
            const printer = mode === "cashier" ? toText(data.printer, 200) : null;
            q.setStationPrint.run(mode, printer, id);
            io.emit("stations_refresh");
        });

        // Fiş istasyon cihazından elle basılır; kasa yazıcısı seçiliyse iş kasadaki ajana gider
        on("print_ticket", async (data) => {
            const stationId = validStation(data.stationId);
            const station = q.stationPrint.get(stationId) as { print_mode: string; printer_name: string | null };
            if (station.print_mode !== "cashier") throw new UserError("Bu istasyon kasa yazıcısını kullanmıyor.");
            const printer = station.printer_name ?? (q.getSetting.get("receipt_printer") as { value: string } | undefined)?.value;
            if (!printer) throw new UserError("Kasa yazıcısı seçilmemiş. Ayarlar > Fiş bölümünden bir yazıcı seçin.");
            let batchId = data.test ? (q.lastStationBatch.get(stationId) as { batch: number | null }).batch : toId(data.batchId);
            if (!data.test && (!batchId || !q.ticketExists.get(stationId, batchId))) throw new UserError("Fiş bulunamadı.");
            batchId ??= 0; // istasyonun hiç fişi yoksa test için örnek fiş basılır
            await printViaAgent(`/print/ticket?station=${stationId}&batch=${batchId}`, printer);
        }, { cashierOnly: false });

        // --- Kasa: fiş ayarları ---

        on("set_receipt_printer", (data) => {
            const printer = toText(data.printer, 200);
            if (printer) q.upsertSetting.run("receipt_printer", printer);
            else q.deleteSetting.run("receipt_printer");
        });

        on("save_receipt_template", (data) => {
            if (!Array.isArray(data.template)) throw new UserError("Geçersiz fiş şablonu.");
            const template = sanitizeTemplate(data.template);
            if (template.length === 0) throw new UserError("Fişe en az bir öğe ekleyin.");
            q.upsertSetting.run("receipt_template", JSON.stringify(template));
        });

        on("print_test_receipt", async (data) => {
            const printer = toText(data.printer, 200) ?? (q.getSetting.get("receipt_printer") as { value: string } | undefined)?.value;
            if (!printer) throw new UserError("Önce bir yazıcı seçin.");
            await printViaAgent("/print/ticket?sample=1", printer);
        });

        // İstasyon "Hazır" der; garson ekranlarına bildirim gider
        on("mark_ticket_ready", (data) => {
            if (updateTicket(data, q.markTicketReady)) io.emit("ready_update", { newReady: true });
        }, { cashierOnly: false });

        // İstasyon veya fişi alan garson teslimi onaylar
        on("deliver_ticket", (data) => {
            if (updateTicket(data, q.deliverTicket)) io.emit("ready_update");
        }, { cashierOnly: false });

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
