export interface Table { id: number; name: string; status: "free" | "occupied"; }
/** Fiş yazdırma: kapalı, kasa bilgisayarındaki yazıcı veya istasyon cihazının kendi yazıcısı. */
export type PrintMode = "none" | "cashier" | "device";
export interface Station { id: number; name: string; print_mode: PrintMode; printer_name: string | null; }
export interface Category { id: number; name: string; station_id: number | null; }
export interface Product { id: number; name: string; price: number; category: string; station_id: number | null; }
/** NULL: istasyonsuz ürün, 'pending': hazırlanıyor, 'ready': hazır (garson bekleniyor), 'delivered': garsona teslim edildi. */
export type PrepStatus = "pending" | "ready" | "delivered" | null;
export interface OrderItem { id: number; name: string; quantity: number; price: number; prep_status: PrepStatus; station_name: string | null; }
export interface OrderNote { id: number; note: string; created_at: string; }
export interface TableOrder { id: number; items: OrderItem[]; notes: OrderNote[]; }
export type Settings = Record<string, string>;

/** İstasyon ekranındaki fiş: bir masanın tek seferde gönderdiği siparişin o istasyona düşen kalemleri. */
export interface StationTicket {
    batchId: number;
    stationId: number;
    stationName: string;
    tableNo: number;
    createdAt: string;
    deliveredAt: string | null;
    notes: string[];
    items: { id: number; name: string; quantity: number }[];
}

export type PaymentMethod = "cash" | "card";
export interface SaleSummary { count: number; total: number; paid: number; cash: number; card: number; }
export interface ProductSale { name: string; category: string | null; quantity: number; revenue: number; }
export interface Sale { id: number; table_no: number; total: number; paid_amount: number; payment_method: PaymentMethod; closed_at: string; item_count: number; }
export interface DailySales { date: string; summary: SaleSummary; products: ProductSale[]; sales: Sale[]; }

/** Socket olaylarına sunucunun döndürdüğü yanıt. */
export type Result = { ok: true; data?: unknown } | { ok: false; error: string };
