"use client";

import { ChefHat, Printer } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useLang } from "@/components/Providers";
import AppShell from "@/components/AppShell";
import { translations } from "@/lib/translations";
import { getSocket, request, send } from "@/lib/socket";
import { printInFrame, ticketUrl } from "@/lib/print";
import { getLastTicketBatch } from "@/app/actions";
import type { Category, PrintMode, Station } from "@/lib/types";

type PrinterInfo = { agent: boolean; printers: string[] };

/** İstasyon kartındaki fiş yazdırma ayarı: yöntem, kasa yazıcısı ve test baskısı. */
function PrintSettings({ station, printerInfo, defaultPrinter, stationUrl, t }: {
    station: Station; printerInfo: PrinterInfo | null; defaultPrinter: string | undefined; stationUrl: string; t: Record<string, string>;
}) {
    const [testing, setTesting] = useState(false);
    // Kayıtlı yazıcı artık listede olmasa da seçili görünsün
    const printers = [...new Set([...(printerInfo?.printers ?? []), ...(station.printer_name ? [station.printer_name] : [])])];

    const save = (mode: PrintMode, printer: string | null = station.printer_name) =>
        send("set_station_printer", { id: station.id, mode, printer: mode === "cashier" ? printer : null });

    const testPrint = async () => {
        setTesting(true);
        if (station.print_mode === "cashier") {
            if (await send("print_ticket", { stationId: station.id, test: true }, 25_000)) alert(t.testPrintSent);
        } else {
            await printInFrame(ticketUrl(station.id, (await getLastTicketBatch(station.id)) ?? 0));
        }
        setTesting(false);
    };

    return (
        <div className="pt-4 space-y-2" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div className="text-sm font-semibold flex items-center gap-2">
                <Printer size={16} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.printing}
            </div>
            <div className="flex flex-wrap gap-2">
                <select value={station.print_mode} onChange={(e) => save(e.target.value as PrintMode)} className="field flex-1 min-w-[12rem]">
                    <option value="none">{t.printOff}</option>
                    <option value="cashier">{t.printCashier}</option>
                    <option value="device">{t.printDevice}</option>
                </select>
                {station.print_mode !== "none" && (
                    <button onClick={testPrint} disabled={testing}
                        className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: "var(--surface-hover)" }}>
                        {t.testPrint}
                    </button>
                )}
            </div>
            {station.print_mode === "cashier" && (
                <>
                    <select value={station.printer_name ?? ""} onChange={(e) => save("cashier", e.target.value || null)} className="field w-full">
                        <option value="">{t.defaultPrinter}{defaultPrinter ? ` (${defaultPrinter})` : ""}</option>
                        {printers.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                    {printers.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{printerInfo?.agent ? t.noPrinters : t.noPrintAgent}</p>}
                </>
            )}
            {station.print_mode === "cashier" && printers.length > 0 && printerInfo && !printerInfo.agent && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.noPrintAgent}</p>
            )}
            {station.print_mode === "device" && (
                <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
                    <p>{t.devicePrintHelp}</p>
                    <code className="block px-2 py-1 rounded break-all" style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)" }}>
                        chrome --kiosk-printing {stationUrl}
                    </code>
                </div>
            )}
        </div>
    );
}

export default function StationsClient({ stations, categories, baseUrl, defaultPrinter }: { stations: Station[]; categories: Category[]; baseUrl: string; defaultPrinter?: string }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    const [newName, setNewName] = useState("");
    const [printerInfo, setPrinterInfo] = useState<PrinterInfo | null>(null);

    // Yazıcı listesi kasadaki masaüstü uygulamasından (yazdırma ajanı) alınır
    useEffect(() => {
        request("list_printers").then((res) => { if (res.ok) setPrinterInfo(res.data as PrinterInfo); });
    }, []);

    useEffect(() => {
        const socket = getSocket();
        const onRefresh = () => window.location.reload();
        socket.on("stations_refresh", onRefresh);
        socket.on("menu_refresh", onRefresh);
        return () => { socket.off("stations_refresh", onRefresh); socket.off("menu_refresh", onRefresh); };
    }, []);

    const addStation = async () => {
        if (newName.trim() && await send("add_station", { name: newName })) setNewName("");
    };

    return (
        <AppShell active="/dashboard/stations">
            <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2"><ChefHat size={22} strokeWidth={1.75} style={{ color: "var(--text-secondary)" }} /> {t.stations}</h2>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{t.stationsDesc}</p>
                </div>

                <div className="flex gap-2">
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.addStation} maxLength={40}
                        className="field flex-1" onKeyDown={(e) => e.key === "Enter" && addStation()} />
                    <button onClick={addStation} className="px-4 py-2 bg-accent hover:bg-accent-hover rounded-lg text-sm font-semibold text-accent-fg transition-colors">{t.add}</button>
                </div>

                {stations.length === 0 && <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>{t.noStations}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stations.map((station) => {
                        const url = `${baseUrl}/station/${station.id}`;
                        const linked = categories.filter((c) => c.station_id === station.id);
                        return (
                            <div key={station.id} className="card rounded-2xl p-5 space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-lg">{station.name}</h3>
                                            <button onClick={() => confirm(`${station.name}?`) && send("delete_station", { id: station.id })}
                                                className="text-danger-ink hover:opacity-70 text-xs">{t.deleteStation}</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2 mb-3">
                                            {linked.map((c) => (
                                                <span key={c.id} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-hover)" }}>{c.name}</span>
                                            ))}
                                        </div>
                                        <div className="text-xs font-mono break-all text-warning-ink mb-1">{url}</div>
                                        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{t.stationScreenHelp}</p>
                                        <Link href={`/station/${station.id}`} target="_blank"
                                            className="inline-block px-4 py-2 bg-success hover:bg-success-hover rounded-lg text-sm font-semibold text-white transition-colors">
                                            {t.openStationScreen}
                                        </Link>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl self-start">
                                        <QRCodeSVG value={url} size={96} />
                                    </div>
                                </div>
                                <PrintSettings station={station} printerInfo={printerInfo} defaultPrinter={defaultPrinter} stationUrl={url} t={t} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </AppShell>
    );
}
