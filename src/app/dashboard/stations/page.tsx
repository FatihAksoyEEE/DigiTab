import { getCategories, getSettings, getStations } from "@/app/actions";
import { getLanAddresses } from "@/lib/network";
import StationsClient from "./StationsClient";

export const dynamic = "force-dynamic";

export default async function StationsPage() {
    const [stations, categories, settings] = await Promise.all([getStations(), getCategories(), getSettings()]);
    const host = getLanAddresses()[0] ?? "localhost";
    const baseUrl = `http://${host}:${process.env.PORT || 3000}`;
    return <StationsClient stations={stations} categories={categories} baseUrl={baseUrl} defaultPrinter={settings.receipt_printer} />;
}
