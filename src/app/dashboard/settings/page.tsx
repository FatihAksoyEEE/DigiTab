import { getSettings, getTables } from "@/app/actions";
import { getLanAddresses } from "@/lib/network";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [settings, tables] = await Promise.all([getSettings(), getTables()]);
    const host = getLanAddresses()[0] ?? "localhost";
    const waiterUrl = `http://${host}:${process.env.PORT || 3000}/waiter`;
    return <SettingsClient settings={settings} tableCount={tables.length} waiterUrl={waiterUrl} initialTab={(await searchParams).tab === "receipt" ? "receipt" : "general"} />;
}
