# SelfieBox Studio

```
frontend/  index.html · img/ (aset dari Figma) · ARCHITECTURE.md (struktur MVC, cara menambah halaman)
           css/  tokens.css · base.css · components.css · pages/ (landing, booking, account, session, admin)
           js/   main.js (titik masuk) · config.js (API, Google Drive, kontak CS)
                 core/ (router, store, html, events, render, format) · models/ · views/ · components/
                 controllers/ (Booking, Payment, Studio, AdminBooking, Auth, Account, Package, PhotoSession, Gallery, Landing, Admin)
           tests/ (tes unit node --test, tanpa browser)
backend/   server.js (REST API + file statis) · db.js (skema + migrasi) · mailer.js (SMTP) · seed.json
           reset-admin.js · reset-db.js · seed-demo.js · test.js · test-admin.js · test-v3.js · test-v4.js
           test-admin-studio.js · test-admin-session.js · test-admin-booking.js (fitur admin studio, sesi, booking)
           test-imk.js (lingkup IMK: tanpa onboarding/promo/add-on, Pilihan Paket, popup booking, Ringkasan Studio, Akses Ditolak)
```

Branch `refactor/frontend-mvc` memakai frontend MVC dengan modul ES (HTML/CSS/JS murni, tanpa build step); strukturnya dijelaskan di [`frontend/ARCHITECTURE.md`](frontend/ARCHITECTURE.md). Branch ini **tidak digabung ke `main`** dan tidak disinkronkan dengannya; Render tetap menyajikan `main`, jadi branch ini dijalankan secara lokal.

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
for f in test-admin test-v3 test-v4 test-admin-studio test-admin-session test-admin-booking test-imk; do node --disable-warning=ExperimentalWarning $f.js || break; done
```
Tes unit frontend (dari folder aplikasi, tanpa server atau browser):
```
node --test "frontend/tests/**/*.test.js"
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

Dengan `DEMO_DATA=1` ikut dibuat: 4 customer contoh (`@selfiebox.test`, password sama dengan customer demo), booking di setiap status (Terbayar, Menunggu Pembayaran, Selesai, Dibatalkan dengan refund berhasil / gagal / kedaluwarsa / oleh admin) dengan tanggal relatif ke hari ini, 3 item keuangan, dan sesi studio contoh tiap jam 09.00-17.50 untuk hari ini sampai 6 hari ke depan di setiap studio (booking aktif yang jadwalnya cocok ditautkan ke sesinya). Booking milik akun-akun demo itu dihapus lalu dibuat ulang setiap kali dijalankan; data customer lain tidak disentuh. Booking "Menunggu Pembayaran" otomatis batal 15 menit setelah seed, jadi jalankan ulang tepat sebelum demo.

### Reset database (lokal)
```
cd backend
npm run db:reset                 # minta konfirmasi, hapus database + isi uploads/ media/ outbox/, isi ulang seed.json
npm run db:reset -- --demo       # sekaligus jalankan seed:demo
npm run db:reset -- --yes --keep-files   # tanpa konfirmasi, berkas unggahan tidak dihapus
```
Matikan server dulu (script menolak jika server masih jalan di `PORT`). Semua customer, booking, pembayaran, galeri, dan akun admin hilang; data awal (paket, studio, properti, pose) dibuat ulang.

## UI (mengikuti file Figma IMK)
Font Poppins, warna biru `#506fce` + oranye `#f28800`. Desktop: navbar atas (Beranda · Booking · Galeri). Mobile: top bar + bottom bar.
Alur customer: Landing -> Beranda (Browse + Filter Jadwal) -> Studio (Properti, hanya tampilan) -> Pilih Tanggal & Waktu (1/2) -> Paket & Pembayaran (2/2) -> Check Out -> bayar -> Studio Berhasil Direservasi.
Dari Beranda, **Lihat semua paket** membuka **Pilihan Paket** (kartu paket, lencana "Paling Favorit" untuk paket aktif yang paling banyak dibayar); **Pilih Paket Ini** menyimpan paket lalu kembali ke Beranda untuk memilih studio, dan langkah paket memakai paket itu.
**Tamu** (belum login) boleh membuka Beranda, Detail Studio, Pilihan Paket, dan mengisi form booking sampai melihat total; login diminta saat Check Out (popup **Belum Login**), lalu booking dilanjutkan di Paket & Pembayaran dengan studio, sesi, dan paket yang sama. Booking Saya, Galeri, Sesi, dan Akun tetap perlu login.
Galat Create Booking tampil sebagai **popup** sesuai frame Figma: Input Tidak Valid (belum pilih tanggal/sesi), Sesi Tidak Tersedia (sesi lewat atau studio tidak tersedia), Paket Tidak Ditemukan / Paket Foto Tidak Ditemukan (paket nonaktif, dengan daftar paket pengganti), Maaf, Sesi Sudah Dibooking, dan Belum Login. Reschedule memakai popup yang sama.
Booking Saya (Mendatang/Riwayat) -> Detail -> Reschedule / Batalkan -> Refund Berhasil / Gagal. Akun: Edit Profil, Riwayat Pembayaran (Kwitansi Digital), Keluar.
Admin: Dashboard, Pengguna, Studio (Detail Studio + Detail Sesi), Booking (daftar + panel Detail Booking), Properti, Pose, Transaksi, Paket & Diskon (paket + diskon utama).

## Konfigurasi frontend (`frontend/js/config.js`)
`API_BASE` (backend terpisah), `GOOGLE_CLIENT_ID` (foto otomatis ke Google Drive), `CS_WA` / `CS_EMAIL` (tombol Customer Service).

## Akun
- **Customer**: login email + password. Lupa sandi / Ubah sandi -> tautan dikirim ke email.
- **Admin**: masuk lewat form yang sama dengan customer, isi **username** admin (bukan email) di kolom "Email atau username"; setelah masuk langsung ke panel admin. Akun admin disimpan di **database** (tabel `admin`, password di-hash scrypt + salt), bukan di kode — lihat bagian Keamanan admin.
- **Staf**: menu avatar -> Mode Staf (PIN dari `STAFF_PIN`).

## Aturan penting
- Sesi 50 menit per jam, 08.00-20.50 (WIB, `TZ_OFFSET_MIN`).
- Total = biaya studio + paket (setelah diskon utama). Tidak ada kode promo dan tidak ada add-on: properti studio hanya ditampilkan (kategori + jumlah) dan boleh dipakai tanpa biaya.
- Harga bisa dilihat tamu (`POST /api/quote` publik); membuat booking (`POST /api/bookings`) perlu login customer.
- Pembatalan: refund otomatis bila >= `REFUND_MIN_HOURS` jam sebelum sesi; jika lebih dekat, refund gagal dan uang tetap dihitung sebagai pendapatan.
- Pembatalan oleh admin (langsung, lewat ubah status, atau karena studio/sesi/booking dihapus) selalu refund 100%.
- Properti dengan Qty 0 tampil "Habis". Gambar studio/properti diunggah admin (disimpan di `backend/media`, diperkecil di browser).

## Fitur admin studio, sesi, dan booking
- **Tambah studio** dua langkah: form "Detail Studio Baru" (nama dan gambar wajib di form; nama tidak boleh sama dengan studio lain) -> **Lihat Ringkasan** -> kartu **Ringkasan Studio** (semua isian + gambar) dengan **Ubah** atau **Simpan Studio**. Bila server menolak (misalnya nama dipakai studio yang baru ditambahkan admin lain), form terbuka lagi dengan isian utuh. Ubah studio tetap satu langkah. API tidak mewajibkan gambar (default `/img/studio-2.jpg`).
- **Akses Ditolak**: bila API admin menjawab 403 "Hanya admin" (misalnya token bukan admin), panel admin menampilkan dialog **Akses ditolak** (Kembali ke Beranda / Masuk sebagai Admin) setelah sesi dihapus, termasuk saat halaman admin dimuat ulang. Customer yang membuka tampilan admin tetap diarahkan ke Beranda tanpa dialog.
- **Studio**: status `AVAILABLE`/`UNAVAILABLE` (studio tidak tersedia disembunyikan dari customer dan tidak bisa dibooking), nama unik, daftar menampilkan status, biaya, dan jumlah sesi. Hapus studio = soft delete: admin melihat dampaknya (jumlah sesi, booking aktif, total refund) dan mengonfirmasi; booking aktif dibatalkan, di-refund 100%, dan customer menerima email. Studio dengan sesi foto yang sedang berjalan tidak bisa dihapus.
- **Sesi studio** (panel "Detail Sesi" di tiap studio): kalender bulanan, tambah sesi (tanggal, jam mulai-selesai, bisa diulang 1-30 hari), ubah, dan hapus. Sesi tidak boleh bertabrakan di studio yang sama. Sesi yang tertaut booking aktif berstatus terisi; ubah/hapus meminta konfirmasi lalu mengirim email ke customer (hapus = batal + refund 100%). Customer belum membooking sesi ini; booking masih memakai slot per jam.
- **Booking** (panel "Detail Booking"): data customer, jadwal, paket, status, pembayaran, invoice, dan rincian biaya. **Ubah**: paket hanya sebelum dibayar (total dihitung ulang: biaya studio + paket setelah diskon utama); status hanya maju (Menunggu Pembayaran → Dibatalkan; Terbayar → Sesi Berjalan / Selesai / Dibatalkan dengan refund 100%; Sesi Berjalan → Selesai). **Hapus**: selalu dengan konfirmasi; booking terbayar di-refund dulu, bila refund gagal booking dipertahankan sebagai Dibatalkan dengan "Refund gagal"; booking yang sedang/sudah berjalan atau yang refundnya gagal tidak bisa dihapus. Customer menerima email untuk setiap perubahan.
- Tindakan yang berdampak pada booking memakai dialog konfirmasi; API membalas 409 `needs_confirm` beserta `impact` sampai dipanggil ulang dengan `?confirm=1`. Email dikirim lewat SMTP (`SMTP_*`), atau ditulis ke `backend/outbox/` bila `SMTP_HOST` kosong.

## Homepage (sebelum login)
Halaman utama satu halaman gulir dengan navbar (Home, About, Fasilitas, Keterangan, Contact Us, Masuk, Join Sekarang): hero, tentang studio, fasilitas (studio, properti, fitur), cara booking, paket & harga, informasi penting, formulir Contact Us, dan footer. Data studio/properti/paket diambil dari database sehingga ikut berubah saat admin mengeditnya. Formulir kontak dikirim ke email `CONTACT_EMAIL` (atau `MAIL_FROM`/`SMTP_USER`). Tombol **Lihat Studio** (hero dan menu mobile), **Lihat Studio & Jadwal**, kartu studio, dan **Lihat semua paket** membuka Beranda/Detail Studio/Pilihan Paket tanpa login.

## Keamanan admin
- Akun admin ada di tabel `admin`; `ADMIN_USER`/`ADMIN_PASS` hanya dipakai **sekali** untuk membuat akun awal bila tabel masih kosong. Jika tidak diisi, dibuat `adminstudio` / `admin123` dan **wajib diganti saat login pertama** (seluruh fitur admin lain diblokir di server sampai password diganti).
- Password baru minimal 8 karakter (huruf + angka). Mengganti password mencabut semua sesi admin lama.
- 5x salah login -> akun terkunci 15 menit. Respons login sama untuk username salah/password salah.
- Lupa password / akun terkunci: `cd backend && node reset-admin.js <username> <password-baru>`.
- Kelola dari panel: menu **Akun Admin** (ganti username/password).
- Akun demo untuk presentasi: lihat bagian **Akun demo** (`npm run seed:demo`).
