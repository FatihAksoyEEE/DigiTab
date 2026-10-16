import { getTables, getSettings } from "@/app/actions";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const [tables, settings] = await Promise.all([getTables(), getSettings()]);
    return <DashboardClient initialTables={tables} settings={settings} />;
}
