# SelfieBox Studio

```
frontend/  index.html · css/style.css · img/ (aset dari Figma)
           js/config.js (API, Google Drive, kontak CS) · api.js · core.js (shell, navigasi, login)
           landing.js (homepage sebelum login)
           customer.js (Beranda, Studio, Booking, Booking Saya, Pembatalan/Refund, Akun)
           session.js (Sesi foto, Google Drive, Galeri) · admin.js (panel admin) · boot.js
backend/   server.js (REST API + file statis) · db.js (skema + migrasi) · mailer.js (SMTP) · seed.json
           reset-admin.js · test.js · test-admin.js · test-v3.js · test-v4.js
```

## Menjalankan
Node.js >= 22.5 (tanpa `npm install`).
```
cd backend
cp .env.example .env      # isi JWT_SECRET, STAFF_PIN, SMTP_*, dst. (dibaca otomatis)
npm start                 # http://localhost:3000
npm test && npm run test:admin && npm run test:v3 && npm run test:v4
```
Database lama (`snapia.db`) otomatis dimigrasi saat server dinyalakan; data tidak hilang.

## UI (mengikuti file Figma IMK)
Font Poppins, warna biru `#506fce` + oranye `#f28800`. Desktop: navbar atas (Beranda · Booking · Galeri). Mobile: top bar + bottom bar.
Alur customer: Beranda (Browse + Filter Jadwal) -> Studio (Properti) -> Pilih Tanggal & Waktu (1/2) -> Paket & Pembayaran (2/2) -> Booking Berhasil.
Booking Saya (Mendatang/Riwayat) -> Detail -> Reschedule / Batalkan -> Refund Berhasil / Gagal. Akun: Edit Profil, Preferensi, Riwayat Pembayaran (Kwitansi Digital), Keluar.
Admin: Dashboard, Pengguna, Studio, Booking, Properti, Pose, Transaksi, Paket & Diskon.

## Konfigurasi frontend (`frontend/js/config.js`)
`API_BASE` (backend terpisah), `GOOGLE_CLIENT_ID` (foto otomatis ke Google Drive), `CS_WA` / `CS_EMAIL` (tombol Customer Service).

## Akun
- **Customer**: login email + password. Lupa sandi / Ubah sandi -> tautan dikirim ke email.
- **Admin**: link "Masuk sebagai admin" di halaman masuk. Akun admin disimpan di **database** (tabel `admin`, password di-hash scrypt + salt), bukan di kode — lihat bagian Keamanan admin.
- **Staf**: menu avatar -> Mode Staf (PIN dari `STAFF_PIN`).

## Aturan penting
- Sesi 50 menit per jam, 08.00-20.50 (WIB, `TZ_OFFSET_MIN`).
- Total = biaya studio + paket (setelah diskon utama) + add-on properti - kode promo.
- Pembatalan: refund otomatis bila >= `REFUND_MIN_HOURS` jam sebelum sesi; jika lebih dekat, refund gagal dan uang tetap dihitung sebagai pendapatan.
- Properti dengan Qty 0 tampil "Habis". Gambar studio/properti diunggah admin (disimpan di `backend/media`, diperkecil di browser).

## Homepage (sebelum login)
Halaman utama satu halaman gulir dengan navbar (Home, About, Fasilitas, Keterangan, Contact Us, Masuk, Join Sekarang): hero, tentang studio, fasilitas (studio, properti, fitur), cara booking, paket & harga, informasi penting, formulir Contact Us, dan footer. Data studio/properti/paket diambil dari database sehingga ikut berubah saat admin mengeditnya. Formulir kontak dikirim ke email `CONTACT_EMAIL` (atau `MAIL_FROM`/`SMTP_USER`).

## Keamanan admin
- Akun admin ada di tabel `admin`; `ADMIN_USER`/`ADMIN_PASS` hanya dipakai **sekali** untuk membuat akun awal bila tabel masih kosong. Jika tidak diisi, dibuat `adminstudio` / `admin123` dan **wajib diganti saat login pertama** (seluruh fitur admin lain diblokir di server sampai password diganti).
- Password baru minimal 8 karakter (huruf + angka). Mengganti password mencabut semua sesi admin lama.
- 5x salah login -> akun terkunci 15 menit. Respons login sama untuk username salah/password salah.
- Lupa password / akun terkunci: `cd backend && node reset-admin.js <username> <password-baru>`.
- Kelola dari panel: menu **Akun Admin** (ganti username/password).

(AKUN ADMIN

id : adminstudio
pw : admin123
another pw : admin.123
)
