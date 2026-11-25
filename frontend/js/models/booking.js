// Booking milik pelanggan: quote, buat, ubah jadwal, daftar milik sendiri, dan turunannya (rincian pembayaran, sesi yang sudah hilang).
// Murni (tanpa DOM, tanpa store); api diberikan pemanggil. Dulu loadQuote, slotGone, payRows, PAYLBL, bookOf, UPCOMING, REASONS, canChange,
// stTag dan isi V.my di customer.js.
import { formatRupiah, parseSlot } from "../core/format.js";
import { packageOf } from "./master.js";
import { freeHours } from "./studio.js";

// label status pembayaran (pay_status dari server)
export const PAYMENT_LABELS = { paid: "Lunas", refunded: "Refunded", refund_failed: "Refund gagal", pending: "Menunggu pembayaran", batal: "Batal" };

// rincian harga sebelum booking dibuat (boleh untuk tamu)
export function quote(api, { packageId, studioId }) {
  return api.post("/quote", { package_id: packageId, studio_id: studioId });
}

// slot = "YYYY-MM-DD HH:00"; server membuat booking, sesi dan pembayaran menunggu dalam satu transaksi
export function create(api, { packageId, studioId, slot }) {
  return api.post("/bookings", { package_id: packageId, studio_id: studioId, date: slot });
}

export function reschedule(api, id, { studioId, slot }) {
  return api.patch("/bookings/" + id, { studio_id: studioId, date: slot });
}

export function listMine(api) {
  return api.get("/bookings");
}

export function bookingById(bookings, id) {
  return bookings.find(booking => booking.id == id);
}

// sesi yang sudah lewat / terisi menurut data ketersediaan terakhir (aturan server: sesi dimulai setelah sekarang)
export function isSlotGone(cache, studioId, slot, now) {
  const { date, h } = parseSlot(slot);
  return !freeHours(cache, studioId, date, now).includes(h);
}

// baris rincian pembayaran sebuah booking: [label, nilai, kelas]; biaya studio (data lama) + paket, diskon utama, total
export function paymentRows(master, booking) {
  const fee = booking.studio_fee || 0;
  const rows = [["Studio", formatRupiah(fee)], ["Paket " + packageOf(master, booking.package_id).name, formatRupiah(booking.subtotal - fee)]];
  if (booking.main_disc) {
    rows.push(["Diskon utama", "-" + formatRupiah(booking.main_disc), "disc"]);
  }
  rows.push(["Total", formatRupiah(booking.amount), "total"]);
  return rows;
}

// ---------- Booking Saya, detail, pembatalan ----------

// status yang tampil di tab Mendatang; sisanya di Riwayat
export const UPCOMING_STATUSES = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan"];

// alasan pembatalan (sama dengan REASONS di server); "Pembatalan lainnya" wajib disertai teks
export const CANCEL_REASONS = ["Tidak ada waktu", "Penggunaan dana lain", "Pemesanan ganda", "Pembatalan lainnya"];

const PENDING = "Menunggu Pembayaran";

// booking yang masih bisa diubah jadwal atau dibatalkan
export function canChange(booking) {
  return [PENDING, "Terbayar"].includes(booking.status);
}

// warna label status: ok (hijau), no (merah), warn (kuning)
export function statusTone(status) {
  if (["Terbayar", "Selesai", "Sesi Berjalan"].includes(status)) {
    return "ok";
  }
  return status === "Dibatalkan" ? "no" : "warn";
}

// booking belum dibayar yang sudah lewat batas bayar tampil Dibatalkan (server membatalkannya pada permintaan berikutnya);
// salinan baru, data asli tidak diubah (decisions.md 56)
export function withLocalExpiry(booking, now) {
  if (booking.status === PENDING && now.getTime() > booking.expire_at) {
    return { ...booking, status: "Dibatalkan" };
  }
  return booking;
}

// booking milik user untuk satu tab: "up" = Mendatang, "hist" = Riwayat
export function myBookings(bookings, { userId, tab, now }) {
  return bookings
    .filter(booking => booking.user_id == userId)
    .map(booking => withLocalExpiry(booking, now))
    .filter(booking => UPCOMING_STATUSES.includes(booking.status) === (tab === "up"));
}

// [{ date, bookings }]: Mendatang naik (terdekat dulu), Riwayat turun (terbaru dulu)
export function groupByDay(bookings, tab) {
  const ascending = tab === "up";
  const sorted = [...bookings].sort((first, second) => {
    const earlier = first.date < second.date;
    return ascending === earlier ? -1 : 1;
  });
  const groups = [];
  for (const booking of sorted) {
    const date = parseSlot(booking.date).date;
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.bookings.push(booking);
    } else {
      groups.push({ date, bookings: [booking] });
    }
  }
  return groups;
}

// jawaban { ok, refund: { state: "refunded" | "failed" | "none", amount, at, min_hours }, booking }
export function cancel(api, id, { reason, detail }) {
  return api.post(`/bookings/${id}/cancel`, { reason, detail });
}
