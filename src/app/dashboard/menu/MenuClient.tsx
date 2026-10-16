"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { getSocket, send } from "@/lib/socket";
import { formatPrice } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

export default function MenuClient({ categories, products }: { categories: Category[]; products: Product[] }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [newCatName, setNewCatName] = useState("");
    const [newProdName, setNewProdName] = useState("");
    const [newProdPrice, setNewProdPrice] = useState("");
    const [newProdCategory, setNewProdCategory] = useState(categories[0]?.name || "");

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
        if (await send("add_product", { name: newProdName, price: Number(newProdPrice), categoryName: newProdCategory })) {
            setNewProdName("");
            setNewProdPrice("");
        }
    };

    return (
        <AppShell active="/dashboard/menu">
            <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">📁 {t.categories}</h2>
                    <div className="flex gap-2 mb-4">
                        <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t.addCategory} maxLength={40}
                            className="field flex-1" onKeyDown={(e) => e.key === "Enter" && addCategory()} />
                        <button onClick={addCategory} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors">+</button>
                    </div>
                    <div className="space-y-2">
                        {categories.map((cat) => (
                            <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--surface-secondary)" }}>
                                <span>{cat.name}</span>
                                <button onClick={() => send("delete_category", { id: cat.id })} className="text-red-400 hover:text-red-300 text-xs">{t.deleteCategory}</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card lg:col-span-2 rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🛒 {t.products}</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} placeholder={t.addProduct} maxLength={60} className="field flex-1 min-w-[150px]" />
                        <input value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} type="number" min={0} step="0.01" placeholder={t.price} className="field w-24" />
                        <select value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} className="field">
                            {categories.map((cat) => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}
                        </select>
                        <button onClick={addProduct} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold text-white transition-colors">{t.add}</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {products.map((prod) => (
                            <div key={prod.id} className="p-4 rounded-xl flex items-center justify-between" style={{ background: "var(--surface)", border: "1px solid var(--card-border)" }}>
                                <div>
                                    <div className="font-semibold">{prod.name}</div>
                                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{prod.category}</div>
                                    <div className="text-emerald-500 font-bold mt-1">{formatPrice(prod.price)}</div>
                                </div>
                                <button onClick={() => send("delete_product", { id: prod.id })} className="text-red-400 hover:text-red-300 text-xs">{t.deleteProduct}</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
