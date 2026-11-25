// Popup galat Create Booking (Figma 585:3886, 585:4061, 585:4358, 585:4400) dan "Booking Gagal": opsi openModal untuk BookingController.
// View murni; teks sama dengan kode lama (inputInvalid, sesiGone, sesiBooked, needLogin, bookingErr di customer.js).
// Juga dua modal konfirmasi Booking Saya (dulu dialog bawaan browser, decisions.md 4, 27, 57): resolve true bila tombol aksi ditekan.
// Paket Tidak Ditemukan (585:4251) ada di views/customer/packages.js (PackageController).
import { html } from "../../core/html.js";
import { modalIcon } from "../../components/modal.js";

export function inputInvalidModal() {
  return {
    title: "Input Tidak Valid",
    className: "center",
    kicker: modalIcon("alert"),
    body: html`<p>Input booking tidak lengkap atau tidak valid. Pilih tanggal dan sesi terlebih dahulu.</p>`,
    buttons: [{ label: "Pilih Tanggal & Sesi", value: 1, icon: "calendar" }],
  };
}

// studioShown = studio masih bisa dipesan (sesinya yang hilang); slotText = "08:00 - 08:50" atau kosong
export function sessionGoneModal({ studioShown, slotText }) {
  return {
    title: "Sesi Tidak Tersedia",
    className: "center",
    kicker: modalIcon("clock"),
    body: studioShown ? html`<p>Sesi ${slotText} tidak lagi tersedia. Silakan pilih sesi lain.</p>` : html`<p>Studio ini sedang tidak tersedia. Silakan pilih studio lain.</p>`,
    buttons: [studioShown ? { label: "Pilih Sesi Lain", value: 1, icon: "calendar" } : { label: "Cari Studio Lain", value: 1, icon: "search" }],
  };
}

export function sessionBookedModal() {
  return {
    title: "Maaf, Sesi Sudah Dibooking",
    className: "center",
    kicker: modalIcon("calendar"),
    body: html`<p>Sesi ini sudah memiliki booking aktif. Silakan pilih sesi lain.</p>`,
    buttons: [{ label: "Pilih Sesi Lain", value: 1, icon: "calendar" }],
  };
}

// Belum Login: resolve "login" / "register"
export function loginRequiredModal() {
  return {
    title: "Masuk untuk melanjutkan booking",
    className: "center",
    kicker: modalIcon("info", "blue"),
    body: html`<p>Kamu belum login. Silakan masuk terlebih dahulu untuk membooking sesi.</p>`,
    buttons: [{ label: "Masuk", value: "login", icon: "user" }, { label: "Daftar", value: "register", style: "ghost" }],
  };
}

// galat lain dari server: pesannya apa adanya (di-escape)
export function bookingFailedModal(message) {
  return {
    title: "Booking Gagal",
    className: "center",
    kicker: modalIcon("alert"),
    body: html`<p>${message}</p>`,
    buttons: [{ label: "Tutup", value: null }],
  };
}

// token kedaluwarsa (401) saat membatalkan / membayar booking yang sudah ada: tanpa draf booking, hanya masuk kembali
export function sessionExpiredModal() {
  return {
    title: "Sesi Login Berakhir",
    className: "center",
    kicker: modalIcon("info", "blue"),
    body: html`<p>Sesi login kamu sudah berakhir. Silakan masuk kembali untuk melanjutkan.</p>`,
    buttons: [{ label: "Masuk", value: "login", icon: "user" }],
  };
}

// Batalkan booking (BookingController.cancel); "Kembali" agar tidak bersanding "Batal" dengan "Batalkan"
export function cancelConfirmModal() {
  return {
    title: "Konfirmasi Pembatalan",
    body: html`<p>Yakin membatalkan booking ini?</p>`,
    buttons: [{ label: "Kembali", value: false, style: "ghost" }, { label: "Ya, Batalkan", value: true }],
  };
}

// Bayar booking yang tertunda dari Detail Booking (PaymentController.payNow)
export function payConfirmModal() {
  return {
    title: "Konfirmasi Pembayaran",
    body: html`<p>Bayar sekarang via QRIS (simulasi)?</p>`,
    buttons: [{ label: "Batal", value: false, style: "ghost" }, { label: "Bayar", value: true }],
  };
}
