"use client";

import { Check, DatabaseBackup, Info, QrCode, Receipt, Save, Settings as SettingsIcon, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { send } from "@/lib/socket";
import type { Settings } from "@/lib/types";
import ReceiptSettings from "./ReceiptSettings";

type Tab = "general" | "receipt";

export default function SettingsClient({ settings, tableCount, waiterUrl, initialTab }: { settings: Settings; tableCount: number; waiterUrl: string; initialTab: Tab }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [restaurantName, setRestaurantName] = useState(settings.restaurant_name || "DigiTab POS");
    const [managerName, setManagerName] = useState(settings.manager_name || "Kasa Yöneticisi");
    const [newTableCount, setNewTableCount] = useState(tableCount);
    const [settingsSaved, setSettingsSaved] = useState(false);
    const [tab, setTab] = useState<Tab>(initialTab);
    // Seçili sekme adreste tutulur; sayfa yenilenince aynı sekme açılır
    const selectTab = (next: Tab) => {
        setTab(next);
        window.history.replaceState(null, "", next === "general" ? "/dashboard/settings" : `/dashboard/settings?tab=${next}`);
    };
    const tabs: { id: Tab; label: string; Icon: typeof Receipt }[] = [
        { id: "general", label: t.generalTab, Icon: SlidersHorizontal },
        { id: "receipt", label: t.receiptTab, Icon: Receipt },
    ];

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
            <div className={`flex-1 p-6 mx-auto w-full space-y-6 ${tab === "receipt" ? "max-w-6xl" : "max-w-3xl"}`}>
                <h2 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon size={22} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.settings}</h2>

                <div role="tablist" className="flex gap-1" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    {tabs.map(({ id, label, Icon }) => (
                        <button key={id} role="tab" aria-selected={tab === id} onClick={() => selectTab(id)}
                            className="px-4 py-2.5 -mb-px text-sm font-semibold flex items-center gap-2 transition-colors"
                            style={tab === id ? { borderBottom: "2px solid var(--accent)", color: "var(--text-primary)" } : { borderBottom: "2px solid transparent", color: "var(--text-secondary)" }}>
                            <Icon size={16} strokeWidth={1.75} /> {label}
                        </button>
                    ))}
                </div>

                {tab === "receipt" && <ReceiptSettings settings={settings} t={t} />}

                {tab === "general" && <>

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
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${settingsSaved ? "bg-success text-white" : "bg-accent hover:bg-accent-hover text-accent-fg"}`}>
                                {settingsSaved ? <><Check size={16} strokeWidth={2} /> {lang === "TR" ? "Kaydedildi" : "Saved"}</> : <><Save size={16} strokeWidth={2} /> {t.updateInfo}</>}
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
                            className="px-6 py-2 bg-danger hover:bg-danger-hover rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2"><Save size={16} strokeWidth={2} /> {t.saveTableCount}</button>
                    </div>

                    <div className="card rounded-2xl p-6 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-lg">{t.dataBackup}</h3>
                            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.backupDesc}</p>
                        </div>
                        <button onClick={backup} className="px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2" style={{ background: "var(--surface-hover)" }}><DatabaseBackup size={16} strokeWidth={2} /> {t.backupNow}</button>
                    </div>

                    <div className="card rounded-2xl p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2"><QrCode size={20} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.waiterAccess}</h3>
                                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{t.waiterAccessDesc}</p>
                                <div className="px-4 py-2 bg-warning/10 border border-warning/30 rounded-lg text-warning-ink text-sm font-mono">{waiterUrl}</div>
                                <p className="text-xs mt-3 max-w-md flex items-start gap-1.5" style={{ color: "var(--text-muted)" }}><Info size={14} className="mt-px shrink-0" /> {t.waiterHelp}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl">
                                <QRCodeSVG value={waiterUrl} size={140} />
                            </div>
                        </div>
                    </div>
                </>}
            </div>
        </AppShell>
    );
}
