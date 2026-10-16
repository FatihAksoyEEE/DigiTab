"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { send } from "@/lib/socket";
import type { Settings } from "@/lib/types";

export default function SettingsClient({ settings, tableCount, waiterUrl }: { settings: Settings; tableCount: number; waiterUrl: string }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [restaurantName, setRestaurantName] = useState(settings.restaurant_name || "DigiTab POS");
    const [managerName, setManagerName] = useState(settings.manager_name || "Kasa Yöneticisi");
    const [newTableCount, setNewTableCount] = useState(tableCount);
    const [settingsSaved, setSettingsSaved] = useState(false);

    const saveSettings = async () => {
        if (await send("update_settings", { restaurant_name: restaurantName, manager_name: managerName })) {
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
        }
    };
    const backup = async () => {
        if (await send("backup_database")) alert(lang === "TR" ? "Yedekleme başarılı!" : "Backup successful!");
    };

    return (
        <AppShell active="/dashboard/settings">
            <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">⚙️ {t.settings}</h2>

                <div className="card rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-1">{t.generalSettings}</h3>
                    <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{t.businessInfo}</p>
                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-sm font-medium mb-1 block">{t.restaurantName}</span>
                            <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} maxLength={60} className="field w-full" />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium mb-1 block">{t.managerName}</span>
                            <input value={managerName} onChange={(e) => setManagerName(e.target.value)} maxLength={60} className="field w-full" />
                        </label>
                        <button onClick={saveSettings}
                            className={`px-6 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-300 flex items-center gap-2 ${settingsSaved ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                            {settingsSaved ? "✅ " + (lang === "TR" ? "Kaydedildi!" : "Saved!") : "💾 " + t.updateInfo}
                        </button>
                    </div>
                </div>

                <div className="card rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-1">{t.tableManagement}</h3>
                    <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{t.tableLayout}</p>
                    <div className="flex items-center gap-4 mb-2">
                        <label className="text-sm font-medium" htmlFor="table-count">{t.totalTables}</label>
                        <input id="table-count" type="number" min={1} max={100} value={newTableCount}
                            onChange={(e) => setNewTableCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} className="field w-20" />
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.currentTables}: <strong>{tableCount}</strong> {t.tables2}</span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{t.tableCountNote}</p>
                    <button onClick={() => send("update_table_count", { count: newTableCount })}
                        className="px-6 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2">💾 {t.saveTableCount}</button>
                </div>

                <div className="card rounded-2xl p-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg">{t.dataBackup}</h3>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.backupDesc}</p>
                    </div>
                    <button onClick={backup} className="px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2" style={{ background: "var(--surface-hover)" }}>⚙️ {t.backupNow}</button>
                </div>

                <div className="card rounded-2xl p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">🔗 {t.waiterAccess}</h3>
                            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{t.waiterAccessDesc}</p>
                            <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-300 text-sm font-mono">{waiterUrl}</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl">
                            <QRCodeSVG value={waiterUrl} size={140} />
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
