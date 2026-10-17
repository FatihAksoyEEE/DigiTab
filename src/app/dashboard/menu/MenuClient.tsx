"use client";

import { Plus, Tags, UtensilsCrossed } from "lucide-react";
import { useState, useEffect } from "react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { getSocket, send } from "@/lib/socket";
import { formatPrice } from "@/lib/format";
import type { Category, Product, Station } from "@/lib/types";

/** İstasyon seçimi; boş değer "istasyon yok" (kategori) veya "kategoriye göre" (ürün) anlamına gelir. */
function StationSelect({ stations, value, emptyLabel, onChange, className = "" }: {
    stations: Station[]; value: number | null; emptyLabel: string; onChange: (stationId: number | null) => void; className?: string;
}) {
    return (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={`field ${className}`}>
            <option value="">{emptyLabel}</option>
            {stations.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
    );
}

export default function MenuClient({ categories, products, stations }: { categories: Category[]; products: Product[]; stations: Station[] }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [newCatName, setNewCatName] = useState("");
    const [newProdName, setNewProdName] = useState("");
    const [newProdPrice, setNewProdPrice] = useState("");
    const [newProdCategory, setNewProdCategory] = useState(categories[0]?.name || "");
    const [newProdStation, setNewProdStation] = useState<number | null>(null);
    const stationName = (id: number | null) => stations.find((s) => s.id === id)?.name;

    useEffect(() => {
        const socket = getSocket();
        const onRefresh = () => window.location.reload();
        socket.on("menu_refresh", onRefresh);
        return () => { socket.off("menu_refresh", onRefresh); };
    }, []);

    const addCategory = async () => {
        if (newCatName.trim() && await send("add_category", { name: newCatName })) setNewCatName("");
    };
    const addProduct = async () => {
        if (!newProdName.trim() || !newProdPrice) return;
        if (await send("add_product", { name: newProdName, price: Number(newProdPrice), categoryName: newProdCategory, stationId: newProdStation })) {
            setNewProdName("");
            setNewProdPrice("");
        }
    };

    return (
        <AppShell active="/dashboard/menu">
            <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Tags size={20} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.categories}</h2>
                    <div className="flex gap-2 mb-4">
                        <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t.addCategory} maxLength={40}
                            className="field flex-1" onKeyDown={(e) => e.key === "Enter" && addCategory()} />
                        <button onClick={addCategory} className="px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-semibold text-accent-fg transition-colors flex items-center" aria-label={t.add}><Plus size={18} strokeWidth={2} /></button>
                    </div>
                    <div className="space-y-2">
                        {categories.map((cat) => (
                            <div key={cat.id} className="flex items-center justify-between gap-2 p-3 rounded-lg" style={{ background: "var(--surface-secondary)" }}>
                                <span className="flex-1 min-w-0 truncate">{cat.name}</span>
                                {stations.length > 0 && (
                                    <StationSelect stations={stations} value={cat.station_id} emptyLabel={t.noStation} className="text-xs py-1 max-w-[9rem]"
                                        onChange={(stationId) => send("set_category_station", { id: cat.id, stationId })} />
                                )}
                                <button onClick={() => send("delete_category", { id: cat.id })} className="text-danger-ink hover:opacity-70 text-xs">{t.deleteCategory}</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card lg:col-span-2 rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><UtensilsCrossed size={20} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.products}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} placeholder={t.addProduct} maxLength={60} className="field flex-1 min-w-[150px]" />
                        <input value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} type="number" min={0} step="0.01" placeholder={t.price} className="field w-24" />
                        <select value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} className="field">
                            {categories.map((cat) => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}
                        </select>
                        {stations.length > 0 && (
                            <StationSelect stations={stations} value={newProdStation} emptyLabel={`${t.station}: ${t.sameAsCategory}`} onChange={setNewProdStation} />
                        )}
                        <button onClick={addProduct} className="px-4 py-2 bg-success hover:bg-success-hover rounded-lg text-sm font-semibold text-white transition-colors">{t.add}</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {products.map((prod) => (
                            <div key={prod.id} className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--card-border)" }}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold">{prod.name}</div>
                                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{prod.category}</div>
                                        <div className="text-success-ink font-bold mt-1">{formatPrice(prod.price)}</div>
                                    </div>
                                    <button onClick={() => send("delete_product", { id: prod.id })} className="text-danger-ink hover:opacity-70 text-xs">{t.deleteProduct}</button>
                                </div>
                                {stations.length > 0 && (() => {
                                    const categoryStation = stationName(categories.find((c) => c.name === prod.category)?.station_id ?? null);
                                    return (
                                        <StationSelect stations={stations} value={prod.station_id} className="w-full mt-2 text-xs py-1"
                                            emptyLabel={`${t.sameAsCategory} (${categoryStation ?? t.noStation})`}
                                            onChange={(stationId) => send("set_product_station", { id: prod.id, stationId })} />
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
