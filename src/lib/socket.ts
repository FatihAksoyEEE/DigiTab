"use client";

import { io, Socket } from "socket.io-client";
import type { Result } from "./types";

let socket: Socket | null = null;

export function getSocket(): Socket {
    socket ??= io({ reconnectionDelay: 1000 });
    return socket;
}

/** Olayı sunucuya gönderir; başarısız olursa kullanıcıya hatayı gösterir. */
export async function send(event: string, data?: object): Promise<boolean> {
    let res: Result;
    try {
        res = await getSocket().timeout(5000).emitWithAck(event, data);
    } catch {
        res = { ok: false, error: "Sunucuya ulaşılamadı." };
    }
    if (!res.ok) alert(res.error);
    return res.ok;
}
