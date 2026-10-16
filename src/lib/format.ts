export const formatPrice = (value: number) => `₺${Number(value).toFixed(2)}`;

// SQLite CURRENT_TIMESTAMP değerleri UTC olarak saklanır
export const formatTime = (sqliteUtc: string) =>
    new Date(sqliteUtc.replace(" ", "T") + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
