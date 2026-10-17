// İstasyon fişi şablonu: fiş, sırayla basılan widget'lardan oluşur. Ayarlarda `receipt_template` anahtarında JSON olarak saklanır.

export const WIDGET_TYPES = ["restaurant", "station", "table", "date", "time", "ticketNo", "items", "notes", "itemCount", "divider", "text", "spacer"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export type WidgetSize = "sm" | "md" | "lg" | "xl";
export type WidgetAlign = "left" | "center" | "right";

export interface ReceiptWidget {
    id: string;
    type: WidgetType;
    size: WidgetSize;
    align: WidgetAlign;
    bold: boolean;
    /** Serbest metin içeriği veya ön ek (ör. masa numarasından önce "MASA", notlardan önce "NOT:"). */
    text: string;
}

export const MAX_WIDGETS = 30;
const SIZES: WidgetSize[] = ["sm", "md", "lg", "xl"];
const ALIGNS: WidgetAlign[] = ["left", "center", "right"];

/** Widget türüne göre varsayılan görünüm ve hangi ayarların düzenlenebildiği. */
export const WIDGET_DEFS: Record<WidgetType, { size: WidgetSize; align: WidgetAlign; bold: boolean; text: string; textEditable: boolean; styled: boolean }> = {
    restaurant: { size: "sm", align: "center", bold: false, text: "", textEditable: false, styled: true },
    station: { size: "md", align: "center", bold: true, text: "", textEditable: false, styled: true },
    table: { size: "xl", align: "center", bold: true, text: "MASA", textEditable: true, styled: true },
    date: { size: "sm", align: "center", bold: false, text: "", textEditable: false, styled: true },
    time: { size: "sm", align: "center", bold: false, text: "", textEditable: false, styled: true },
    ticketNo: { size: "sm", align: "center", bold: false, text: "Fiş #", textEditable: true, styled: true },
    items: { size: "lg", align: "left", bold: true, text: "", textEditable: false, styled: true },
    notes: { size: "md", align: "left", bold: true, text: "NOT:", textEditable: true, styled: true },
    itemCount: { size: "sm", align: "right", bold: false, text: "Toplam adet:", textEditable: true, styled: true },
    divider: { size: "md", align: "center", bold: false, text: "", textEditable: false, styled: false },
    text: { size: "md", align: "center", bold: false, text: "Afiyet olsun", textEditable: true, styled: true },
    spacer: { size: "md", align: "center", bold: false, text: "", textEditable: false, styled: false },
};

let counter = 0;
export const newWidgetId = () => `w${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createWidget(type: WidgetType): ReceiptWidget {
    const { size, align, bold, text } = WIDGET_DEFS[type];
    return { id: newWidgetId(), type, size, align, bold, text };
}

/** Önceki sabit fiş düzeniyle aynı görünen varsayılan şablon. */
export const DEFAULT_TEMPLATE: ReceiptWidget[] = (["restaurant", "station", "table", "date", "time", "divider", "items", "notes", "divider"] as WidgetType[])
    .map((type, i) => ({ ...createWidget(type), id: `d${i}` }));

/** Kayıtlı ya da istemciden gelen şablonu doğrular; bozuk değerler varsayılanlarla düzeltilir, bilinmeyen widget'lar atılır. */
export function sanitizeTemplate(raw: unknown): ReceiptWidget[] {
    let value = raw;
    if (typeof value === "string") {
        try { value = JSON.parse(value); } catch { return DEFAULT_TEMPLATE; }
    }
    if (!Array.isArray(value)) return DEFAULT_TEMPLATE;
    const seen = new Set<string>();
    const widgets: ReceiptWidget[] = [];
    for (const w of value.slice(0, MAX_WIDGETS)) {
        if (!w || typeof w !== "object" || !WIDGET_TYPES.includes(w.type)) continue;
        const def = WIDGET_DEFS[w.type as WidgetType];
        let id = typeof w.id === "string" && /^[\w-]{1,40}$/.test(w.id) ? w.id : newWidgetId();
        if (seen.has(id)) id = newWidgetId();
        seen.add(id);
        widgets.push({
            id,
            type: w.type,
            size: SIZES.includes(w.size) ? w.size : def.size,
            align: ALIGNS.includes(w.align) ? w.align : def.align,
            bold: typeof w.bold === "boolean" ? w.bold : def.bold,
            text: typeof w.text === "string" ? w.text.slice(0, 120) : def.text,
        });
    }
    return widgets;
}

/** Fişte gösterilen veriler. */
export interface ReceiptData {
    restaurantName: string;
    stationName: string;
    tableNo: number | null;
    ticketNo: number | null;
    createdAt: Date;
    items: { id: number; name: string; quantity: number }[];
    notes: string[];
}

/** Önizleme ve test baskısı için örnek fiş. */
export const sampleReceipt = (restaurantName: string, stationName = "Mutfak"): ReceiptData => ({
    restaurantName,
    stationName,
    tableNo: 4,
    ticketNo: 128,
    createdAt: new Date(),
    items: [{ id: 1, name: "Adana Kebap", quantity: 2 }, { id: 2, name: "Ayran", quantity: 3 }, { id: 3, name: "Künefe", quantity: 1 }],
    notes: ["Az pişmiş, soğansız"],
});
