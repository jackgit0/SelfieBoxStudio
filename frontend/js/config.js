// Konfigurasi frontend
window.API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "" : "https://selfieboxstudio.onrender.com";          // lokal = backend lokal; kosong = backend satu domain dengan frontend; isi URL backend bila dipisah
window.GOOGLE_CLIENT_ID = "";  // OAuth Client ID (Web) untuk pengiriman foto otomatis ke Google Drive
window.CS_WA = "";             // nomor WhatsApp Customer Service format internasional, mis. 6281234567890
window.CS_EMAIL = "";          // atau email Customer Service (ditampilkan di halaman Contact Us)
