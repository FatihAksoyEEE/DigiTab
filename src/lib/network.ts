import os from "os";

/** Garson cihazlarının bağlanabileceği yerel ağ IPv4 adresleri. */
export function getLanAddresses(): string[] {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter((net) => net && net.family === "IPv4" && !net.internal)
        .map((net) => net!.address);
}

/** İstek kasa bilgisayarının kendisinden mi geliyor? */
export function isLocalAddress(address: string | undefined): boolean {
    return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
