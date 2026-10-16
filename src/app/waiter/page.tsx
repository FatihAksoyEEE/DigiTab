import { getTables } from "@/app/actions";
import WaiterClient from "./WaiterClient";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
    return <WaiterClient initialTables={await getTables()} />;
}
