"use client";

/**
 * Fiş sayfasını gizli bir çerçevede açıp bu cihazın yazıcısına gönderir. Tarayıcı yazdırma penceresi gösterir;
 * Chrome `--kiosk-printing` ile açıldıysa pencere çıkmadan varsayılan yazıcıya basar.
 */
export function printInFrame(url: string): Promise<void> {
    return new Promise((resolve) => {
        const frame = document.createElement("iframe");
        // 80 mm ≈ 302 px; ekran dışında tutulur, gizlenirse bazı tarayıcılar boş sayfa basar
        frame.style.cssText = "position:fixed;left:-10000px;top:0;width:302px;height:900px;border:0";
        const done = () => { frame.remove(); resolve(); };
        frame.onload = () => {
            frame.contentWindow?.focus();
            frame.contentWindow?.print(); // yazdırma penceresi kapanana kadar bekler
            setTimeout(done, 500);
        };
        frame.onerror = done;
        frame.src = url;
        document.body.appendChild(frame);
    });
}

export const ticketUrl = (stationId: number, batchId: number) => `/print/ticket?station=${stationId}&batch=${batchId}`;
