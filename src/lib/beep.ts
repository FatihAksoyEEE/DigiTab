"use client";

/** Kısa bir uyarı sesi çalar. Tarayıcı, sayfaya bir kez dokunulmadan sese izin vermeyebilir. */
export function beep(frequency = 880, times = 1) {
    try {
        const ctx = new AudioContext();
        for (let i = 0; i < times; i++) {
            const start = ctx.currentTime + i * 0.25;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = frequency;
            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.2);
            if (i === times - 1) osc.onended = () => ctx.close();
        }
    } catch { /* ses desteklenmiyor */ }
}
