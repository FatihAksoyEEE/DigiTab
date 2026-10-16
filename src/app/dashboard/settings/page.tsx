import { getSettings, getTables } from "@/app/actions";
import { getLanAddresses } from "@/lib/network";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const [settings, tables] = await Promise.all([getSettings(), getTables()]);
    const host = getLanAddresses()[0] ?? "localhost";
    const waiterUrl = `http://${host}:${process.env.PORT || 3000}/waiter`;
    return <SettingsClient settings={settings} tableCount={tables.length} waiterUrl={waiterUrl} />;
}
