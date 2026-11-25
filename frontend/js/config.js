// Konfigurasi frontend (modul ES). Tidak menyentuh window saat diimpor, agar tes Node bisa memuatnya.

// alamat backend: lokal = backend lokal (kosong = backend satu domain dengan frontend); domain lain = backend di Render.
// Isi URL backend di sini bila frontend dan backend dipisah.
export function apiBaseFor(hostname) {
  return /^(localhost|127\.0\.0\.1)$/.test(hostname) ? "" : "https://selfieboxstudio.onrender.com";
}

export const API_BASE = apiBaseFor(globalThis.location ? globalThis.location.hostname : "localhost");

// OAuth Client ID (Web) untuk pengiriman foto otomatis ke Google Drive
export const GOOGLE_CLIENT_ID = "";

// nomor WhatsApp Customer Service format internasional, mis. 6281234567890
export const CS_WA = "";

// atau email Customer Service (ditampilkan di halaman Contact Us)
export const CS_EMAIL = "";

// nama yang tampil di navbar, landing, dan halaman masuk
export const BRAND = "SelfieBox Studio";
