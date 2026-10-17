import type { ReceiptData, ReceiptWidget, WidgetSize } from "@/lib/receipt";

// Hook kullanmaz; hem sunucudaki baskı sayfasında hem ayarlardaki canlı önizlemede aynı çıktıyı verir

const FONT_SIZE: Record<WidgetSize, number> = { sm: 11, md: 15, lg: 18, xl: 34 };
const SPACER: Record<WidgetSize, number> = { sm: 4, md: 10, lg: 18, xl: 28 };

/** Fişin içeriği: 72 mm genişlikte, beyaz zemin üzerine siyah. Sayfa boyutu ve kenar boşlukları kullanan sayfaya aittir. */
export default function TicketView({ template, data }: { template: ReceiptWidget[]; data: ReceiptData }) {
    const date = data.createdAt.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = data.createdAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const prefix = (w: ReceiptWidget) => (w.text.trim() ? `${w.text.trim()} ` : "");

    return (
        <div style={{ width: "72mm", padding: "3mm 4mm 6mm", boxSizing: "border-box", fontFamily: "Arial, Helvetica, sans-serif", color: "#000", background: "#fff", lineHeight: 1.25 }}>
            {template.map((w) => {
                const style: React.CSSProperties = { fontSize: FONT_SIZE[w.size], textAlign: w.align, fontWeight: w.bold ? 700 : 400, wordBreak: "break-word" };
                if (w.size === "xl") Object.assign(style, { fontWeight: w.bold ? 800 : 400, lineHeight: 1.1, margin: "4px 0" });

                switch (w.type) {
                    case "restaurant": return <div key={w.id} style={style}>{data.restaurantName}</div>;
                    case "station": return <div key={w.id} style={{ ...style, textTransform: "uppercase", letterSpacing: 0.5 }}>{data.stationName}</div>;
                    case "table": return <div key={w.id} style={style}>{data.tableNo === null ? "TEST" : `${prefix(w)}${data.tableNo}`}</div>;
                    case "date": return <div key={w.id} style={style}>{date}</div>;
                    case "time": return <div key={w.id} style={style}>{time}</div>;
                    case "ticketNo": return data.ticketNo === null ? null : <div key={w.id} style={style}>{w.text.trim()}{data.ticketNo}</div>;
                    case "text": return w.text.trim() ? <div key={w.id} style={{ ...style, whiteSpace: "pre-wrap" }}>{w.text}</div> : null;
                    case "itemCount": return <div key={w.id} style={style}>{prefix(w)}{data.items.reduce((s, i) => s + i.quantity, 0)}</div>;
                    case "divider": return <div key={w.id} style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />;
                    case "spacer": return <div key={w.id} style={{ height: SPACER[w.size] }} />;
                    case "items":
                        return (
                            <table key={w.id} style={{ width: "100%", borderCollapse: "collapse" }}>
                                <tbody>
                                    {data.items.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ ...style, textAlign: "left", width: "1%", whiteSpace: "nowrap", fontWeight: 800, verticalAlign: "top", padding: "2px 3mm 2px 0" }}>{item.quantity} ×</td>
                                            <td style={{ ...style, verticalAlign: "top", padding: "2px 0" }}>{item.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                    case "notes":
                        return data.notes.map((note, i) => (
                            <div key={`${w.id}-${i}`} style={{ ...style, border: "1.5px solid #000", padding: "4px 6px", margin: "6px 0 2px" }}>{prefix(w)}{note}</div>
                        ));
                }
            })}
        </div>
    );
}
