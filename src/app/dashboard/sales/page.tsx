import { getDailySales, getToday } from "@/app/actions";
import SalesClient from "./SalesClient";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const [data, today] = await Promise.all([getDailySales((await searchParams).date), getToday()]);
    return <SalesClient data={data} today={today} />;
}
