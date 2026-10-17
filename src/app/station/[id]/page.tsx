import { notFound } from "next/navigation";
import { getStation, getStationTickets } from "@/app/actions";
import StationClient from "./StationClient";

export const dynamic = "force-dynamic";

export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
    const station = await getStation(Number((await params).id));
    if (!station) notFound();
    return <StationClient station={station} initialTickets={await getStationTickets(station.id)} />;
}
