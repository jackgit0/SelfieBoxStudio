// Booking milik pelanggan: quote, buat, ubah jadwal, daftar milik sendiri, dan turunannya (rincian pembayaran, sesi yang sudah hilang).
// Murni (tanpa DOM, tanpa store); api diberikan pemanggil. Dulu loadQuote, slotGone, payRows, PAYLBL, bookOf di customer.js.
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
