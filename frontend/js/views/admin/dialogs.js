// Dialog panel admin (opsi openModal untuk AdminController): Akses ditolak (Figma 593:4971) dan konfirmasi "Konfirmasi Hapus …".
// View murni; teks sama dengan kode lama (aDenied, aModal di admin.js).
import { html } from "../../core/html.js";

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
