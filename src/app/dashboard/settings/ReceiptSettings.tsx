"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Bold, CalendarDays, ChefHat, ChevronDown, ChevronUp, Clock, GripVertical, Hash, LayoutGrid, ListOrdered, MessageSquareText,
    MoveVertical, Plus, Printer, RotateCcw, Save, SeparatorHorizontal, Sigma, Store, TextAlignCenter, TextAlignEnd, TextAlignStart, Trash2, Type,
} from "lucide-react";
import TicketView from "@/components/TicketView";
import { request, send } from "@/lib/socket";
import {
    createWidget, DEFAULT_TEMPLATE, MAX_WIDGETS, sampleReceipt, sanitizeTemplate, WIDGET_DEFS, WIDGET_TYPES,
    type ReceiptWidget, type WidgetAlign, type WidgetSize, type WidgetType,
} from "@/lib/receipt";
import type { Settings } from "@/lib/types";

type PrinterInfo = { agent: boolean; printers: string[] };

const WIDGET_ICONS: Record<WidgetType, typeof Store> = {
    restaurant: Store, station: ChefHat, table: LayoutGrid, date: CalendarDays, time: Clock, ticketNo: Hash,
    items: ListOrdered, notes: MessageSquareText, itemCount: Sigma, divider: SeparatorHorizontal, text: Type, spacer: MoveVertical,
};
const SIZES: WidgetSize[] = ["sm", "md", "lg", "xl"];
const ALIGNS: { value: WidgetAlign; Icon: typeof Store }[] = [
    { value: "left", Icon: TextAlignStart }, { value: "center", Icon: TextAlignCenter }, { value: "right", Icon: TextAlignEnd },
];

/** Ayarlar > Fiş: varsayılan kasa yazıcısı ve widget'larla düzenlenen istasyon fişi şablonu. */
export default function ReceiptSettings({ settings, t }: { settings: Settings; t: Record<string, string> }) {
    const [printerInfo, setPrinterInfo] = useState<PrinterInfo | null>(null);
    const [printer, setPrinter] = useState(settings.receipt_printer ?? "");
    const [testing, setTesting] = useState(false);
    const saved = useMemo(() => sanitizeTemplate(settings.receipt_template), [settings.receipt_template]);
    const [template, setTemplate] = useState<ReceiptWidget[]>(saved);
    const [savedJson, setSavedJson] = useState(() => JSON.stringify(saved));
    const [expanded, setExpanded] = useState<string | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const dirty = JSON.stringify(template) !== savedJson;
    const preview = useMemo(() => sampleReceipt(settings.restaurant_name || "DigiTab POS"), [settings.restaurant_name]);
    const label = (type: WidgetType) => t[`w_${type}`] ?? type;

    // Yazıcı listesi kasadaki masaüstü uygulamasından (yazdırma ajanı) alınır
    useEffect(() => {
        request("list_printers").then((res) => { if (res.ok) setPrinterInfo(res.data as PrinterInfo); });
    }, []);

    // Kaydedilmemiş değişiklik varken sayfadan çıkılırsa uyar
    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const printers = [...new Set([...(printerInfo?.printers ?? []), ...(printer ? [printer] : [])])];
    const choosePrinter = async (value: string) => {
        if (await send("set_receipt_printer", { printer: value || null })) setPrinter(value);
    };
    const testPrint = async () => {
        setTesting(true);
        if (await send("print_test_receipt", { printer }, 25_000)) alert(t.testPrintSent);
        setTesting(false);
    };

    const update = (id: string, patch: Partial<ReceiptWidget>) => setTemplate((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    const move = (from: number, to: number) => setTemplate((list) => {
        if (to < 0 || to >= list.length || from === to) return list;
        const next = [...list];
        next.splice(to, 0, next.splice(from, 1)[0]);
        return next;
    });
    const add = (type: WidgetType) => {
        if (template.length >= MAX_WIDGETS) return;
        const widget = createWidget(type);
        setTemplate((list) => [...list, widget]);
        setExpanded(widget.id);
    };
    const save = async () => {
        setSaving(true);
        if (await send("save_receipt_template", { template })) setSavedJson(JSON.stringify(template));
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            <div className="card rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Printer size={20} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.cashierPrinter}</h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{t.cashierPrinterDesc}</p>
                <div className="flex flex-wrap gap-2">
                    <select value={printer} onChange={(e) => choosePrinter(e.target.value)} className="field flex-1 min-w-[14rem]" disabled={printers.length === 0}>
                        <option value="">{printers.length === 0 ? (printerInfo?.agent ? t.noPrinters : t.noPrintAgent) : t.selectPrinter}</option>
                        {printers.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                    <button onClick={testPrint} disabled={!printer || testing}
                        className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50" style={{ background: "var(--surface-hover)" }}>
                        <Printer size={16} strokeWidth={2} /> {t.testPrint}
                    </button>
                </div>
                {printers.length > 0 && printerInfo && !printerInfo.agent && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{t.noPrintAgent}</p>}
            </div>

            <div className="card rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-bold text-lg">{t.receiptLayout}</h3>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.receiptLayoutDesc}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setTemplate(DEFAULT_TEMPLATE); setExpanded(null); }}
                            className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: "var(--surface-hover)" }}>
                            <RotateCcw size={15} strokeWidth={2} /> {t.resetDefault}
                        </button>
                        <button onClick={save} disabled={!dirty || saving}
                            className="px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-semibold text-accent-fg flex items-center gap-2 disabled:opacity-40">
                            <Save size={15} strokeWidth={2} /> {dirty ? t.saveLayout : t.saved}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[11rem_1fr_auto] gap-5 items-start">
                    {/* Eklenebilecek widget'lar */}
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t.addWidget}</div>
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                            {WIDGET_TYPES.map((type) => {
                                const Icon = WIDGET_ICONS[type];
                                return (
                                    <button key={type} onClick={() => add(type)} disabled={template.length >= MAX_WIDGETS}
                                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors hover:bg-(--surface-hover) disabled:opacity-40"
                                        style={{ border: "1px solid var(--border-color)" }}>
                                        <Icon size={15} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} />
                                        <span className="flex-1 truncate">{label(type)}</span>
                                        <Plus size={14} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fişteki sıralı widget'lar */}
                    <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t.receiptContent} ({template.length})</div>
                        {template.length === 0 && <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>{t.emptyReceipt}</p>}
                        <div className="space-y-1.5">
                            {template.map((w, index) => {
                                const Icon = WIDGET_ICONS[w.type];
                                const def = WIDGET_DEFS[w.type];
                                const open = expanded === w.id;
                                return (
                                    <div key={w.id} draggable
                                        onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = "move"; }}
                                        onDragOver={(e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== index) { move(dragIndex, index); setDragIndex(index); } }}
                                        onDragEnd={() => setDragIndex(null)}
                                        className={`rounded-lg transition-opacity ${dragIndex === index ? "opacity-40" : ""}`}
                                        style={{ background: "var(--surface)", border: `1px solid ${open ? "var(--input-border)" : "var(--border-color)"}` }}>
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                            <GripVertical size={16} className="cursor-grab shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden />
                                            <button onClick={() => setExpanded(open ? null : w.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left text-sm py-1">
                                                <Icon size={15} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
                                                <span className="font-medium shrink-0">{label(w.type)}</span>
                                                {def.textEditable && w.text && <span className="truncate" style={{ color: "var(--text-muted)" }}>· {w.text}</span>}
                                            </button>
                                            <button onClick={() => move(index, index - 1)} disabled={index === 0} className="p-1 rounded disabled:opacity-30" aria-label="↑"><ChevronUp size={16} /></button>
                                            <button onClick={() => move(index, index + 1)} disabled={index === template.length - 1} className="p-1 rounded disabled:opacity-30" aria-label="↓"><ChevronDown size={16} /></button>
                                            <button onClick={() => setTemplate((list) => list.filter((x) => x.id !== w.id))} className="p-1 rounded text-danger-ink hover:opacity-70" aria-label={t.deleteProduct}><Trash2 size={15} /></button>
                                        </div>

                                        {open && (def.styled || def.textEditable || w.type === "spacer") && (
                                            <div className="px-3 pb-3 pt-1 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                                                {def.textEditable && (
                                                    <input value={w.text} onChange={(e) => update(w.id, { text: e.target.value })} maxLength={120}
                                                        placeholder={w.type === "text" ? t.customText : t.prefix} className="field flex-1 min-w-[10rem] py-1.5" />
                                                )}
                                                {(def.styled || w.type === "spacer") && (
                                                    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }} title={t.size}>
                                                        {SIZES.map((size) => (
                                                            <button key={size} onClick={() => update(w.id, { size })}
                                                                className={`px-2.5 py-1 text-xs font-semibold uppercase ${w.size === size ? "bg-accent text-accent-fg" : ""}`}>{size === "md" ? "M" : size === "sm" ? "S" : size === "lg" ? "L" : "XL"}</button>
                                                        ))}
                                                    </div>
                                                )}
                                                {def.styled && (
                                                    <>
                                                        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }} title={t.align}>
                                                            {ALIGNS.map(({ value, Icon: AlignIcon }) => (
                                                                <button key={value} onClick={() => update(w.id, { align: value })} aria-label={value}
                                                                    className={`px-2 py-1 ${w.align === value ? "bg-accent text-accent-fg" : ""}`}><AlignIcon size={14} /></button>
                                                            ))}
                                                        </div>
                                                        <button onClick={() => update(w.id, { bold: !w.bold })} aria-label={t.bold} aria-pressed={w.bold}
                                                            className={`px-2 py-1 rounded-lg ${w.bold ? "bg-accent text-accent-fg" : ""}`} style={{ border: "1px solid var(--border-color)" }}><Bold size={14} /></button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Canlı önizleme: basılacak fişle aynı bileşen */}
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>{t.preview}</div>
                        <div className="rounded-md shadow-md overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                            <TicketView template={template} data={preview} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
