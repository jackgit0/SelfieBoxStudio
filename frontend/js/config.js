// Konfigurasi frontend (modul ES). Tidak menyentuh window saat diimpor, agar tes Node bisa memuatnya.

// alamat backend: lokal = backend lokal (kosong = backend satu domain dengan frontend); domain lain = backend di Render.
// Lokal juga mencakup IP jaringan lokal (10.x, 172.16-31.x, 192.168.x, 0.0.0.0), mis. HP di Wi-Fi yang sama membuka laptop.
// Isi URL backend di sini bila frontend dan backend dipisah.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;
export function apiBaseFor(hostname) {
  return LOCAL_HOST.test(hostname) ? "" : "https://selfieboxstudio.onrender.com";
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
