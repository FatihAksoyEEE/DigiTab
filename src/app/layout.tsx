import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "DigiTab POS - Modern Restoran Yönetim Sistemi",
    description: "Restoran ve kafeler için modern adisyon ve yönetim sistemi",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr" suppressHydrationWarning>
            <body className={`${inter.className} bg-background text-foreground antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
