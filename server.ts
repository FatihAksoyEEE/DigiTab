
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('./src/lib/db').default;

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server);

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });

        socket.on('place_order', (data: { tableId: number, items: { id: number, quantity: number, price: number }[], waiterName?: string }) => {
            console.log('Received place_order:', data);
            try {
                const { tableId, items, waiterName } = data;

                const processOrder = db.transaction(() => {
                    // Check for active order or create new one
                    let orderId: number | bigint;
                    const activeOrder = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'").get(tableId) as { id: number };

                    if (activeOrder) {
                        orderId = activeOrder.id;
                    } else {
                        const info = db.prepare("INSERT INTO orders (table_id, status, waiter_name) VALUES (?, 'active', ?)").run(tableId, waiterName || 'Unknown');
                        orderId = info.lastInsertRowid;

                        // Update table status
                        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId);
                    }

                    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
                    items.forEach(item => {
                        insertItem.run(orderId, item.id, item.quantity, item.price);
                    });
                });

                processOrder();

                // Broadcast updates
                io.emit('table_update', { id: tableId, status: 'occupied' });
                io.emit('new_order_notification', { tableId });

                console.log(`Order placed for Table ${tableId} by ${waiterName}`);
            } catch (err) {
                console.error("Order placement failed:", err);
                socket.emit('error', 'Failed to place order');
            }
        });

        socket.on('update_table_count', (data) => {
            console.log('Received update_table_count:', data);
            const { count } = data;
            const newCount = parseInt(count);

            if (isNaN(newCount) || newCount < 1 || newCount > 100) {
                socket.emit('error', 'Invalid table count (1-100)');
                return;
            }

            try {
                const updateTx = db.transaction(() => {
                    const currentTables = db.prepare('SELECT count(*) as count FROM tables').get() as { count: number };
                    const currentCount = currentTables.count;

                    if (newCount > currentCount) {
                        // Add tables
                        const insertTable = db.prepare('INSERT INTO tables (name) VALUES (?)');
                        for (let i = currentCount + 1; i <= newCount; i++) {
                            insertTable.run(`Table ${i}`);
                        }
                    } else if (newCount < currentCount) {
                        // Remove tables (only if free preferably, but strict resize for now)
                        // Ideally we should check for active orders, but for this feature request we'll keep it simple
                        // and only delete if we can, or just delete logic:
                        // "Delete tables with ID > newCount"
                        db.prepare('DELETE FROM tables WHERE id > ?').run(newCount);
                    }
                });

                updateTx();
                console.log(`Table count updated to ${newCount}`);
                io.emit('tables_refresh'); // Tell clients to reload
            } catch (err) {
                console.error("Failed to update table count:", err);
                socket.emit('error', 'Failed to update table count');
            }
        });

        socket.on('add_category', (data) => {
            const { name } = data;
            try {
                db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
                io.emit('tables_refresh'); // reusing tables_refresh as "global data refresh" or make new one
                io.emit('menu_refresh');
            } catch (err) {
                console.error("Failed to add category:", err);
                socket.emit('error', 'Failed to add category');
            }
        });

        const checkAndCloseEmptyOrder = (tableId: number) => {
            const activeOrder = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status = 'active'").get(tableId) as { id: number };
            if (activeOrder) {
                const itemCount = db.prepare("SELECT count(*) as count FROM order_items WHERE order_id = ?").get(activeOrder.id) as { count: number };
                if (itemCount.count === 0) {
                    db.transaction(() => {
                        db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(tableId);
                        db.prepare("UPDATE orders SET status = 'closed' WHERE id = ?").run(activeOrder.id);
                    })();
                    io.emit('table_update', { id: tableId, status: 'free' });
                    console.log(`Table ${tableId} auto-closed due to empty order`);
                }
            }
        };

        socket.on('delete_category', (data) => {
            const { id } = data;
            try {
                db.prepare('DELETE FROM categories WHERE id = ?').run(id);
                io.emit('menu_refresh');
            } catch (err) {
                console.error("Failed to delete category:", err);
                socket.emit('error', 'Bu kategori silinemez. İçinde ürünler olabilir.');
            }
        });

        socket.on('add_product', (data) => {
            const { name, price, categoryName } = data;
            try {
                // simple insert, ignoring category_id for now to avoid schema issues on old DBs
                db.prepare('INSERT INTO products (name, price, category) VALUES (?, ?, ?)').run(name, price, categoryName);
                io.emit('menu_refresh');
            } catch (err) {
                console.error("Failed to add product:", err);
                socket.emit('error', 'Ürün eklenemedi.');
            }
        });

        socket.on('delete_product', (data) => {
            const { id } = data;
            try {
                db.prepare('DELETE FROM products WHERE id = ?').run(id);
                io.emit('menu_refresh');
            } catch (err) {
                console.error("Failed to delete product:", err);
                socket.emit('error', 'Bu ürün silinemez. Geçmiş siparişlerde kayıtlı olabilir.');
            }
        });

        socket.on('remove_order_item', (data) => {
            const { tableId, itemId } = data;
            try {
                db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
                checkAndCloseEmptyOrder(tableId);
                io.emit('new_order_notification', { tableId });
            } catch (err) {
                console.error("Failed to remove order item:", err);
            }
        });

        socket.on('update_order_item_quantity', (data) => {
            const { tableId, itemId, change } = data; // change: +1 or -1
            try {
                const item = db.prepare('SELECT quantity FROM order_items WHERE id = ?').get(itemId) as { quantity: number };
                if (item) {
                    const newQuantity = item.quantity + change;
                    if (newQuantity <= 0) {
                        db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
                    } else {
                        db.prepare('UPDATE order_items SET quantity = ? WHERE id = ?').run(newQuantity, itemId);
                    }
                    checkAndCloseEmptyOrder(tableId);
                    io.emit('new_order_notification', { tableId });
                }
            } catch (err) {
                console.error("Failed to update order item quantity:", err);
            }
        });

        socket.on('close_table', (data) => {
            console.log('Received close_table:', data);
            const { tableId } = data;
            try {
                const closeTx = db.transaction(() => {
                    db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(tableId);
                    db.prepare("UPDATE orders SET status = 'closed' WHERE table_id = ? AND status = 'active'").run(tableId);
                });

                closeTx();
                console.log(`Table ${tableId} closed successfully`);

                io.emit('table_update', { id: tableId, status: 'free' });
            } catch (err) {
                console.error("Close table failed:", err);
            }
        });
    });

    const PORT = 3000;
    const HOST = '0.0.0.0';

    server.listen(PORT, HOST, () => {
        console.log(`> Ready on http://localhost:${PORT}`);

        // Get local IP addresses
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        const addresses: string[] = [];

        for (const name of Object.keys(networkInterfaces)) {
            for (const net of networkInterfaces[name]!) {
                if (net.family === 'IPv4' && !net.internal) {
                    addresses.push(net.address);
                }
            }
        }

        if (addresses.length > 0) {
            console.log('\n📱 Lokal ağ üzerinden erişim:');
            addresses.forEach(addr => {
                console.log(`   http://${addr}:${PORT}`);
            });
            console.log('\nGarson telefonlarından bu adresleri kullanın!\n');
        }
    });
});

