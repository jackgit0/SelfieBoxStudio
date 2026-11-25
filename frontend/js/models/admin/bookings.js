// Booking di panel admin (dulu BSTAT, slotHm, bookEdit, bookSave, openBook, bookDel di admin.js): daftar dengan saringan status, detail,
// ubah paket (hanya sebelum dibayar) dan status (hanya ke tujuan yang diizinkan server, detail.allowed), hapus dengan konfirmasi server.
import { padTwo } from "../../core/format.js";
import { confirmPath } from "./confirmable.js";

// status booking aplikasi, urut seperti alurnya (saringan daftar)
export const STATUSES = ["Menunggu Pembayaran", "Terbayar", "Sesi Berjalan", "Selesai", "Dibatalkan"];

export function statusTone(status) {
  if (["Terbayar", "Selesai", "Sesi Berjalan"].includes(status)) {
    return "ok";
  }
  return status == "Dibatalkan" ? "no" : "warn";
}

// "2026-11-26 9:00" → "09:00 - 09:50" (slot tetap 50 menit)
export function slotHours(slot) {
  const hour = padTwo(Number(String(slot).split(" ")[1].split(":")[0]));
  return `${hour}:00 - ${hour}:50`;
}

export const canChangePackage = detail => detail.status == "Menunggu Pembayaran";

// form Ubah Booking hanya tampil bila paket atau status masih bisa diubah
export const isEditable = detail => canChangePackage(detail) || detail.allowed.length > 0;

export const statusOptions = detail => [detail.status, ...detail.allowed];

// paket yang bisa dipilih: daftar paket aktif terbaru dari server; paket booking yang sudah nonaktif tetap tampil di atas.
// Setelah dibayar hanya paket booking itu (pilihan terkunci). price null = tanpa harga di label
export function packageOptions(detail) {
  if (!canChangePackage(detail)) {
    return [{ id: detail.package_id, name: detail.package_name, price: null }];
  }
  if (detail.packages.some(pkg => pkg.id == detail.package_id)) {
    return detail.packages;
  }
  return [{ id: detail.package_id, name: detail.package_name + " (nonaktif)", price: null }, ...detail.packages];
}

// isian form (status radio, package_id select; select terkunci tidak ikut form) → body PATCH berisi yang berubah saja
export function changeBody(detail, values) {
  const body = {};
  const packageId = Number(values.package_id) || detail.package_id;
  const status = values.status || detail.status;
  if (packageId != detail.package_id) {
    body.package_id = packageId;
  }
  if (status != detail.status) {
    body.status = status;
  }
  return body;
}

export function loadBookings(api, status) {
  return api.get("/admin/bookings?status=" + encodeURIComponent(status));
}

export function loadBooking(api, id) {
  return api.get("/admin/bookings/" + id);
}

// jawaban = detail booking terbaru, plus refund { state, amount } dan notified
export function updateBooking(api, id, body) {
  return api.patch("/admin/bookings/" + id, body);
}

// jawaban { refund, refund_amount } atau { kept: true, message } bila refund gagal (booking disimpan sebagai refund_failed)
export function deleteBooking(api, id, confirmed = false) {
  const path = "/admin/bookings/" + id;
  return api.del(confirmed ? confirmPath(path) : path);
}
