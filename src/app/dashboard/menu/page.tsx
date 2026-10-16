import { getCategories, getProducts } from "@/app/actions";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);
    return <MenuClient categories={categories} products={products} />;
}
