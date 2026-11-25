// Pembantu format murni (tanpa DOM): rupiah, tanggal, jam sesi. Nama lama di js/legacy: rp, rpk, pad, HRS, iso, todayS, dObj, fmtDate, fmtDMY, fmtTime.

export function formatRupiah(amount) {
  return "Rp" + Number(amount || 0).toLocaleString("id-ID");
}

// Rp 65k (kartu studio dan landing)
export function formatRupiahShort(amount) {
  return amount >= 1000 ? "Rp " + Math.round(amount / 1000) + "k" : "Rp " + amount;
}

export function padTwo(number) {
  return String(number).padStart(2, "0");
}

// sesi 50 menit tiap jam, 08.00 sampai 20.00 (sama dengan server)
export const SESSION_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function isoDate(date) {
  return date.getFullYear() + "-" + padTwo(date.getMonth() + 1) + "-" + padTwo(date.getDate());
}

export function todayIso() {
  return isoDate(new Date());
}

export function slotLabel(hour) {
  return `${padTwo(hour)}:00 - ${padTwo(hour)}:50`;
}

// "2026-11-25 14:00" → { date: "2026-11-25", h: 14 }
export function parseSlot(slot) {
  const [date, time] = String(slot).split(" ");
  return { date, h: +time.split(":")[0] };
}

export function slotRange(slot) {
  return slotLabel(parseSlot(slot).h);
}

// "2026-11-25" → Date lokal (tanpa geser zona waktu)
export function dateFromIso(iso) {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

// "Rabu, 25 November"
export function formatDate(iso) {
  return dateFromIso(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

// "25/11/2026"
export function formatDayMonthYear(iso) {
  return iso.split("-").reverse().join("/");
}

// waktu (ms) dalam WIB: "25/11/2026 - 10:04:05"; kosong → "-"
export function formatTime(milliseconds) {
  if (!milliseconds) {
    return "-";
  }
  return new Date(milliseconds)
    .toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .replace(/\./g, ":")
    .replace(",", " -");
}
