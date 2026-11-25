# SelfieBox Studio

```
frontend/  index.html · css/style.css · img/ (aset dari Figma)
           js/config.js (API, Google Drive, kontak CS) · api.js · core.js (shell, navigasi, login)
           landing.js (homepage sebelum login)
           customer.js (Beranda, Studio, Booking, Booking Saya, Pembatalan/Refund, Akun)
           session.js (Sesi foto, Google Drive, Galeri) · admin.js (panel admin) · boot.js
backend/   server.js (REST API + file statis) · db.js (skema + migrasi) · mailer.js (SMTP) · seed.json
           reset-admin.js · reset-db.js · seed-demo.js · test.js · test-admin.js · test-v3.js · test-v4.js
           test-admin-studio.js · test-admin-session.js · test-admin-booking.js (fitur admin studio, sesi, booking)
```

## Menjalankan
Node.js >= 22.5 (tanpa `npm install`).
```
cd backend
cp .env.example .env      # isi JWT_SECRET, STAFF_PIN, SMTP_*, dst. (dibaca otomatis)
npm start                 # http://localhost:3000
npm test                  # = node test.js
```
File tes lain dijalankan langsung dengan node (tiap file menyalakan server sendiri dengan database sementara):
```
for f in test-admin test-v3 test-v4 test-admin-studio test-admin-session test-admin-booking; do node --disable-warning=ExperimentalWarning $f.js || break; done
```
Database lama (`snapia.db`) otomatis dimigrasi saat server dinyalakan; data tidak hilang.

### Akun demo
Akun untuk presentasi tidak ditulis di repo; isinya ada di `backend/.env.demo` (tidak di-commit).
```
cd backend
cp .env.demo.example .env.demo   # isi DEMO_ADMIN_*, (opsional) DEMO_CUSTOMER_*, dan DEMO_DATA
npm run seed:demo                # buat/perbarui akun admin + customer demo di database server
```
Boleh dijalankan berulang (akun yang ada diperbarui, password diatur ulang, kunci akun dibuka). Admin demo tidak diminta mengganti password. Jika dijalankan sebelum server pertama kali menyala, akun bawaan `adminstudio`/`admin123` tidak dibuat.

Dengan `DEMO_DATA=1` ikut dibuat: 4 customer contoh (`@selfiebox.test`, password sama dengan customer demo), kode promo `DEMO10` dan `HEMAT20K`, booking di setiap status (Terbayar, Menunggu Pembayaran, Selesai, Dibatalkan dengan refund berhasil / gagal / kedaluwarsa / oleh admin) dengan tanggal relatif ke hari ini, preferensi customer demo, 3 item keuangan, dan sesi studio contoh tiap jam 09.00-17.50 untuk hari ini sampai 6 hari ke depan di setiap studio (booking aktif yang jadwalnya cocok ditautkan ke sesinya). Booking milik akun-akun demo itu dihapus lalu dibuat ulang setiap kali dijalankan; data customer lain tidak disentuh. Booking "Menunggu Pembayaran" otomatis batal 15 menit setelah seed, jadi jalankan ulang tepat sebelum demo.

### Reset database (lokal)
```
cd backend
npm run db:reset                 # minta konfirmasi, hapus database + isi uploads/ media/ outbox/, isi ulang seed.json
npm run db:reset -- --demo       # sekaligus jalankan seed:demo
npm run db:reset -- --yes --keep-files   # tanpa konfirmasi, berkas unggahan tidak dihapus
```
Matikan server dulu (script menolak jika server masih jalan di `PORT`). Semua customer, booking, pembayaran, promo, galeri, dan akun admin hilang; data awal (paket, studio, vibe, properti, pose) dibuat ulang.

## UI (mengikuti file Figma IMK)
Font Poppins, warna biru `#506fce` + oranye `#f28800`. Desktop: navbar atas (Beranda · Booking · Galeri). Mobile: top bar + bottom bar.
Alur customer: Beranda (Browse + Filter Jadwal) -> Studio (Properti) -> Pilih Tanggal & Waktu (1/2) -> Paket & Pembayaran (2/2) -> Booking Berhasil.
Booking Saya (Mendatang/Riwayat) -> Detail -> Reschedule / Batalkan -> Refund Berhasil / Gagal. Akun: Edit Profil, Preferensi, Riwayat Pembayaran (Kwitansi Digital), Keluar.
Admin: Dashboard, Pengguna, Studio (Detail Studio + Detail Sesi), Booking (daftar + panel Detail Booking), Properti, Pose, Transaksi, Paket & Diskon.

## Konfigurasi frontend (`frontend/js/config.js`)
`API_BASE` (backend terpisah), `GOOGLE_CLIENT_ID` (foto otomatis ke Google Drive), `CS_WA` / `CS_EMAIL` (tombol Customer Service).

## Akun
- **Customer**: login email + password. Lupa sandi / Ubah sandi -> tautan dikirim ke email.
- **Admin**: masuk lewat form yang sama dengan customer, isi **username** admin (bukan email) di kolom "Email atau username"; setelah masuk langsung ke panel admin. Akun admin disimpan di **database** (tabel `admin`, password di-hash scrypt + salt), bukan di kode — lihat bagian Keamanan admin.
- **Staf**: menu avatar -> Mode Staf (PIN dari `STAFF_PIN`).

## Aturan penting
- Sesi 50 menit per jam, 08.00-20.50 (WIB, `TZ_OFFSET_MIN`).
- Total = biaya studio + paket (setelah diskon utama) + add-on properti - kode promo.
- Pembatalan: refund otomatis bila >= `REFUND_MIN_HOURS` jam sebelum sesi; jika lebih dekat, refund gagal dan uang tetap dihitung sebagai pendapatan.
- Pembatalan oleh admin (langsung, lewat ubah status, atau karena studio/sesi/booking dihapus) selalu refund 100%.
- Properti dengan Qty 0 tampil "Habis". Gambar studio/properti diunggah admin (disimpan di `backend/media`, diperkecil di browser).

## Fitur admin studio, sesi, dan booking
- **Studio**: status `AVAILABLE`/`UNAVAILABLE` (studio tidak tersedia disembunyikan dari customer dan tidak bisa dibooking), nama unik, daftar menampilkan status, biaya, dan jumlah sesi. Hapus studio = soft delete: admin melihat dampaknya (jumlah sesi, booking aktif, total refund) dan mengonfirmasi; booking aktif dibatalkan, di-refund 100%, dan customer menerima email. Studio dengan sesi foto yang sedang berjalan tidak bisa dihapus.
- **Sesi studio** (panel "Detail Sesi" di tiap studio): kalender bulanan, tambah sesi (tanggal, jam mulai-selesai, bisa diulang 1-30 hari), ubah, dan hapus. Sesi tidak boleh bertabrakan di studio yang sama. Sesi yang tertaut booking aktif berstatus terisi; ubah/hapus meminta konfirmasi lalu mengirim email ke customer (hapus = batal + refund 100%). Customer belum membooking sesi ini; booking masih memakai slot per jam.
- **Booking** (panel "Detail Booking"): data customer, jadwal, paket, status, pembayaran, invoice, dan rincian biaya. **Ubah**: paket hanya sebelum dibayar (total dihitung ulang, kode promo yang tidak berlaku dilepas); status hanya maju (Menunggu Pembayaran → Dibatalkan; Terbayar → Sesi Berjalan / Selesai / Dibatalkan dengan refund 100%; Sesi Berjalan → Selesai). **Hapus**: selalu dengan konfirmasi; booking terbayar di-refund dulu, bila refund gagal booking dipertahankan sebagai Dibatalkan dengan "Refund gagal"; booking yang sedang/sudah berjalan atau yang refundnya gagal tidak bisa dihapus. Customer menerima email untuk setiap perubahan.
- Tindakan yang berdampak pada booking memakai dialog konfirmasi; API membalas 409 `needs_confirm` beserta `impact` sampai dipanggil ulang dengan `?confirm=1`. Email dikirim lewat SMTP (`SMTP_*`), atau ditulis ke `backend/outbox/` bila `SMTP_HOST` kosong.

## Homepage (sebelum login)
Halaman utama satu halaman gulir dengan navbar (Home, About, Fasilitas, Keterangan, Contact Us, Masuk, Join Sekarang): hero, tentang studio, fasilitas (studio, properti, fitur), cara booking, paket & harga, informasi penting, formulir Contact Us, dan footer. Data studio/properti/paket diambil dari database sehingga ikut berubah saat admin mengeditnya. Formulir kontak dikirim ke email `CONTACT_EMAIL` (atau `MAIL_FROM`/`SMTP_USER`).

## Keamanan admin
- Akun admin ada di tabel `admin`; `ADMIN_USER`/`ADMIN_PASS` hanya dipakai **sekali** untuk membuat akun awal bila tabel masih kosong. Jika tidak diisi, dibuat `adminstudio` / `admin123` dan **wajib diganti saat login pertama** (seluruh fitur admin lain diblokir di server sampai password diganti).
- Password baru minimal 8 karakter (huruf + angka). Mengganti password mencabut semua sesi admin lama.
- 5x salah login -> akun terkunci 15 menit. Respons login sama untuk username salah/password salah.
- Lupa password / akun terkunci: `cd backend && node reset-admin.js <username> <password-baru>`.
- Kelola dari panel: menu **Akun Admin** (ganti username/password).
- Akun demo untuk presentasi: lihat bagian **Akun demo** (`npm run seed:demo`).
