import { getCategories, getProducts, getStations } from "@/app/actions";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
    const [categories, products, stations] = await Promise.all([getCategories(), getProducts(), getStations()]);
    return <MenuClient categories={categories} products={products} stations={stations} />;
}
