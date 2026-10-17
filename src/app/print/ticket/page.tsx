import { notFound } from "next/navigation";
import { getSettings, getStation, getStationTicket } from "@/app/actions";
import TicketView from "@/components/TicketView";
import { sampleReceipt, sanitizeTemplate, type ReceiptData } from "@/lib/receipt";

export const dynamic = "force-dynamic";

// SQLite CURRENT_TIMESTAMP değerleri UTC olarak saklanır
const fromSqlite = (sqliteUtc: string) => new Date(sqliteUtc.replace(" ", "T") + "Z");

/**
 * 80 mm termal yazıcı için istasyon fişi; düzen Ayarlar > Fiş'teki şablondan gelir.
 * `?station=&batch=` gerçek fişi, `?sample=1` (isteğe bağlı `station`) test fişini basar.
 */
export default async function TicketPrintPage({ searchParams }: { searchParams: Promise<{ station?: string; batch?: string; sample?: string }> }) {
    const params = await searchParams;
    const settings = await getSettings();
    const station = params.station ? await getStation(Number(params.station)) : null;
    const batchId = Number(params.batch);
    const restaurantName = settings.restaurant_name ?? "";

    let data: ReceiptData;
    // İstasyonun hiç fişi yokken (batch=0) veya ayarlardan test baskısında örnek fiş basılır
    if (params.sample || batchId === 0) {
        data = { ...sampleReceipt(restaurantName, station?.name), tableNo: null, ticketNo: null, notes: ["Test fişi"] };
    } else {
        if (!station) notFound();
        const ticket = await getStationTicket(station.id, batchId);
        if (!ticket) notFound();
        data = {
            restaurantName, stationName: ticket.stationName, tableNo: ticket.tableNo, ticketNo: ticket.batchId,
            createdAt: fromSqlite(ticket.createdAt), items: ticket.items, notes: ticket.notes,
        };
    }

    return (
        <>
            <style>{`
                @page { size: 80mm auto; margin: 0; }
                html, body { background: #fff !important; color: #000 !important; margin: 0; }
                nextjs-portal { display: none; }
                @media screen { body { padding: 16px; } .ticket-frame { display: inline-block; border: 1px solid #ccc; } }
            `}</style>
            <div className="ticket-frame">
                <TicketView template={sanitizeTemplate(settings.receipt_template)} data={data} />
            </div>
        </>
    );
}
