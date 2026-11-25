// Dialog panel admin (opsi openModal untuk AdminController): Akses ditolak (Figma 593:4971) dan konfirmasi "Konfirmasi Hapus …".
// View murni; teks sama dengan kode lama (aDenied, aModal di admin.js).
import { html } from "../../core/html.js";
import { formatRupiah } from "../../core/format.js";

export const DEFAULT_DENIED = "Hanya admin yang dapat membuka halaman admin.";

// what = kalimat pertama (Figma: "Hanya admin yang dapat menambahkan studio.")
export function accessDeniedModal(what = DEFAULT_DENIED) {
  return {
    title: "Akses ditolak",
    body: html`<p>${what} Akun yang sedang masuk adalah akun pelanggan. Masuk dengan akun admin untuk melanjutkan.</p>`,
    buttons: [{ label: "Kembali ke Beranda", value: "home", style: "ghost" }, { label: "Masuk sebagai Admin", value: "login" }],
  };
}

// konfirmasi admin: resolve true hanya bila tombol aksi ditekan
export function confirmModal({ title, body, okLabel }) {
  return { title, body, buttons: [{ label: "Kembali", value: false, style: "ghost" }, { label: okLabel, value: true }] };
}

// isi konfirmasi hapus di halaman admin umum (dulu confirm() bawaan browser, decisions.md 4, 27)
export const deleteOperationBody = () => html`<p>Hapus item rekap ini?</p>`;
export const deleteCustomerBody = name => html`<p>Hapus akun "${name}" beserta SELURUH booking, pembayaran, dan foto miliknya?</p><p>Tindakan ini tidak dapat dibatalkan.</p>`;
export const deletePackageBody = () => html`<p>Hapus paket ini? (Jika pernah dibeli, paket hanya dinonaktifkan.)</p>`;

// ---------- Studio dan Detail Sesi (StudioController, dulu studioImpactText, sessImpactText, sWho di admin.js) ----------

const customersOf = impact => (impact.customers && impact.customers.length ? ` (${impact.customers.join(", ")})` : "");

// impact = { sessions, active_bookings, paid_bookings, refund_total } dari daftar studio atau 409 needs_confirm
export function studioImpactBody(impact) {
  const paid = impact.paid_bookings ? ` (${impact.paid_bookings} sudah dibayar, total refund ${formatRupiah(impact.refund_total)})` : "";
  const cancel = impact.active_bookings ? "Setelah dikonfirmasi, seluruh booking aktif dibatalkan dan dana yang sudah dibayar dikembalikan 100% kepada pelanggan. " : "";
  return html`<p>Studio ini memiliki ${impact.sessions} sesi dan ${impact.active_bookings} booking aktif${paid}. ${cancel}Studio beserta sesinya tidak lagi tampil, tetapi riwayat booking tetap tersimpan.</p>`;
}

// ubah jam sesi yang sudah dibooking (dialog hanya bila server meminta konfirmasi)
export function sessionChangeBody(impact) {
  return html`<p>Sesi ini memiliki ${impact.active_bookings} booking aktif${customersOf(impact)}. Setelah dikonfirmasi, jadwal sesi diubah dan pelanggan menerima email berisi jadwal baru.</p>`;
}

export function sessionImpactBody(impact) {
  if (!impact.active_bookings) {
    return html`<p>Sesi ini belum memiliki booking aktif dan akan dihapus dari daftar sesi.</p>`;
  }
  const paid = impact.paid_bookings ? `, ${impact.paid_bookings} sudah dibayar (total refund ${formatRupiah(impact.refund_total)})` : "";
  return html`<p>Sesi ini memiliki ${impact.active_bookings} booking aktif${customersOf(impact)}${paid}. Setelah dikonfirmasi, booking tersebut dibatalkan, dana yang sudah dibayar dikembalikan 100%, dan pelanggan diberi tahu lewat email.</p>`;
}
