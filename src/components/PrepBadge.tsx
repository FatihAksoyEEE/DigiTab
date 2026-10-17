"use client";

import { BellRing, Check, Clock } from "lucide-react";
import { useLang } from "@/components/Providers";
import { translations } from "@/lib/translations";
import type { PrepStatus } from "@/lib/types";

/** Kalemin istasyondaki hazırlık durumu; istasyonsuz ürünlerde hiçbir şey göstermez. */
export default function PrepBadge({ status, station }: { status: PrepStatus; station?: string | null }) {
    const { lang } = useLang();
    const t = translations[lang] || translations.TR;
    if (!status) return null;
    const { label, Icon, className } = {
        pending: { label: t.preparing, Icon: Clock, className: "bg-warning/15 text-warning-ink" },
        ready: { label: t.ready, Icon: BellRing, className: "bg-info/15 text-info-ink" },
        delivered: { label: t.delivered, Icon: Check, className: "bg-success/15 text-success-ink" },
    }[status];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold align-middle ${className}`}>
            <Icon size={11} strokeWidth={2.5} />{label}{station ? ` · ${station}` : ""}
        </span>
    );
}
