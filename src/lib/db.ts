import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Electron'da DB_PATH, kullanıcı veri klasörünü gösterir; aksi halde proje kökündeki sqlite.db kullanılır
const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), "sqlite.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'free'
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    waiter_name TEXT DEFAULT 'Unknown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS order_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    waiter_name TEXT DEFAULT 'Unknown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_notes_order ON order_notes(order_id);
`);

// Eski veritabanları: geçmiş siparişlerde kullanılan ürünler silinmek yerine arşivlenir
const productColumns = db.prepare("PRAGMA table_info(products)").all() as { name: string }[];
if (!productColumns.some((c) => c.name === "active")) {
  db.exec("ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
}

const isEmpty = (table: string) => (db.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count === 0;

db.transaction(() => {
  if (isEmpty("settings")) {
    const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    insert.run("restaurant_name", "DigiTab POS");
    insert.run("manager_name", "Kasa Yöneticisi");
  }
  if (isEmpty("tables")) {
    const insert = db.prepare("INSERT INTO tables (name) VALUES (?)");
    for (let i = 1; i <= 10; i++) insert.run(`Table ${i}`);
  }
  if (isEmpty("categories")) {
    const insert = db.prepare("INSERT INTO categories (name) VALUES (?)");
    ["İçecekler", "Yemekler", "Tatlılar"].forEach((name) => insert.run(name));
  }
  if (isEmpty("products")) {
    const insert = db.prepare("INSERT INTO products (name, price, category) VALUES (?, ?, ?)");
    const defaults: [string, number, string][] = [
      ["Kola", 30, "İçecekler"], ["Ayran", 20, "İçecekler"], ["Su", 10, "İçecekler"],
      ["Burger", 150, "Yemekler"], ["Pizza", 200, "Yemekler"], ["Salata", 80, "Yemekler"],
      ["Künefe", 60, "Tatlılar"], ["Baklava", 50, "Tatlılar"],
    ];
    defaults.forEach((p) => insert.run(...p));
  }
})();

const MAX_BACKUPS = 20;

/** WAL içeriği dahil tutarlı bir kopya alır ve yalnızca son MAX_BACKUPS yedeği saklar. */
export async function backupDatabase(): Promise<string> {
  const backupDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `sqlite-backup-${timestamp}.db`);
  await db.backup(backupPath);

  const old = fs.readdirSync(backupDir).filter((f) => f.startsWith("sqlite-backup-")).sort().slice(0, -MAX_BACKUPS);
  old.forEach((f) => fs.unlinkSync(path.join(backupDir, f)));

  return backupPath;
}

export default db;
