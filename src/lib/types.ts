export interface Table { id: number; name: string; status: "free" | "occupied"; }
export interface Category { id: number; name: string; }
export interface Product { id: number; name: string; price: number; category: string; }
export interface OrderItem { id: number; name: string; quantity: number; price: number; }
export interface OrderNote { id: number; note: string; created_at: string; }
export interface TableOrder { id: number; items: OrderItem[]; notes: OrderNote[]; }
export type Settings = Record<string, string>;

/** Socket olaylarına sunucunun döndürdüğü yanıt. */
export type Result = { ok: true } | { ok: false; error: string };
