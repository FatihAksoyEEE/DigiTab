import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Electron'da DB_PATH, kullanıcı veri klasörünü gösterir; aksi halde proje kökündeki sqlite.db kullanılır
const dbPath = () => process.env.DB_PATH || path.resolve(process.cwd(), "sqlite.db");

let db: Database.Database | null = null;

/** Veritabanını ilk kullanımda açar; `next build` gibi yalnızca modülü yükleyen işlemler dosyaya dokunmaz. */
export function getDb(): Database.Database {
  if (!db) db = open(dbPath());
  return db;
}

function open(file: string): Database.Database {
  const db = new Database(file, { timeout: 10_000 });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // IMMEDIATE: aynı anda açan başka bir süreç varsa sırasını bekler, başlangıç verisi iki kez eklenmez
  db.transaction(() => setup(db)).immediate();
  return db;
}

function setup(db: Database.Database) {
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

  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  -- Garsonun tek seferde gönderdiği sipariş; istasyon ekranında bir fiş olarak görünür
  CREATE TABLE IF NOT EXISTS order_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  -- Satış defteri: masa kapatılırken adisyon olduğu gibi kopyalanır. Ürün adı, fiyat ve masa numarası
  -- o anki haliyle saklanır; menü veya masa sayısı sonradan değişse de geçmiş raporlar bozulmaz.
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    table_no INTEGER NOT NULL,
    total REAL NOT NULL,
    paid_amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sales_closed_at ON sales(closed_at);
  CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_notes_order ON order_notes(order_id);
`);

  // Eski veritabanlarına sonradan eklenen sütunlar
  const addColumn = (table: string, column: string, definition: string) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  // Geçmiş siparişlerde kullanılan ürünler silinmek yerine arşivlenir
  addColumn("products", "active", "INTEGER NOT NULL DEFAULT 1");
  // Ürünün istasyonu boşsa kategorinin istasyonu kullanılır
  addColumn("products", "station_id", "INTEGER");
  addColumn("categories", "station_id", "INTEGER");
  // Fiş yazdırma: 'none' (kapalı), 'cashier' (kasa bilgisayarındaki yazıcı), 'device' (istasyon cihazının yazıcısı)
  addColumn("stations", "print_mode", "TEXT NOT NULL DEFAULT 'none'");
  addColumn("stations", "printer_name", "TEXT");
  // İstasyon sipariş anında kaydedilir; menü sonradan değişse de hazırlanan fiş yer değiştirmez.
  // prep_status: NULL (istasyonsuz ürün), 'pending' (hazırlanıyor), 'ready' (hazır), 'delivered' (garsona teslim edildi)
  addColumn("order_items", "batch_id", "INTEGER");
  addColumn("order_items", "station_id", "INTEGER");
  addColumn("order_items", "prep_status", "TEXT");
  addColumn("order_items", "delivered_at", "DATETIME");
  addColumn("order_notes", "batch_id", "INTEGER");
  db.exec("CREATE INDEX IF NOT EXISTS idx_order_items_station ON order_items(station_id, prep_status)");

  // Başlangıç verileri yalnızca ilk kurulumda eklenir (ayarlar tablosu boşken). Sonradan silinen
  // kategori ve masalar yeniden açılışta geri gelmez. Menü boş başlar; ürünler işletme tarafından girilir.
  const isFirstRun = (db.prepare("SELECT count(*) AS count FROM settings").get() as { count: number }).count === 0;
  if (!isFirstRun) return;

  const setting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  setting.run("restaurant_name", "DigiTab POS");
  setting.run("manager_name", "Kasa Yöneticisi");

  if ((db.prepare("SELECT count(*) AS count FROM tables").get() as { count: number }).count === 0) {
    const insert = db.prepare("INSERT INTO tables (name) VALUES (?)");
    for (let i = 1; i <= 10; i++) insert.run(`Table ${i}`);
  }
  if ((db.prepare("SELECT count(*) AS count FROM categories").get() as { count: number }).count === 0) {
    const insert = db.prepare("INSERT INTO categories (name) VALUES (?)");
    ["İçecekler", "Yemekler", "Tatlılar"].forEach((name) => insert.run(name));
  }
}

const MAX_BACKUPS = 20;

/** WAL içeriği dahil tutarlı bir kopya alır ve yalnızca son MAX_BACKUPS yedeği saklar. */
export async function backupDatabase(): Promise<string> {
  const backupDir = path.join(path.dirname(dbPath()), "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `sqlite-backup-${timestamp}.db`);
  await getDb().backup(backupPath);

  const old = fs.readdirSync(backupDir).filter((f) => f.startsWith("sqlite-backup-")).sort().slice(0, -MAX_BACKUPS);
  old.forEach((f) => fs.unlinkSync(path.join(backupDir, f)));

  return backupPath;
}
