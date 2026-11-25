# Sitemap SelfieBox Studio (IMK Kelompok 6)

Berkas diagram: `selfiebox-imk.sitemap.json` (format impor DUMA, lewat **Impor berkas** atau **Tempel…**). Sitemap lama ada di `sitemap-lama.png`. Dokumen ini menjelaskan isi diagram dan apa yang berubah dari sitemap lama.

Sitemap ini dibuat untuk lingkup IMK: **tanpa onboarding** (rekomendasi paket lewat kuis dan personalisasi setup/vibe dari APS tidak ada), **tanpa kode promo dan add-on berbayar**, dan **dengan fitur baru manajemen profil** (Account, Settings, Edit Profile, Preference, Payment History, Receipt, Log Out). Nama halaman mengikuti judul frame di Figma "Tugas 3 High Fidelity" (halaman `64:2`), supaya sitemap cocok dengan prototipe dan website yang didemokan. Kolom **Frame** berisi nomor frame (halaman pelanggan) atau nama frame Figma yang sebenarnya (Landing Page, Pilihan Paket, popup, dan semua halaman Admin).

Pembaruan 2026-11-25 (rencana kode IMK, fase 7): Landing Page, Pilihan Paket, popup galat Create Booking, dan menu Admin disamakan dengan website dan Figma; enam frame admin yang belum ada (Dashboard, Pengguna, Pose, Transaksi, Paket & Diskon, Akun Admin, desktop dan mobile) dibuat dari kode website.

Pembaruan 2026-11-25 (refactor MVC frontend, sudah digabung ke `main`; lihat `../../frontend/ARCHITECTURE.md`): setiap halaman website kini punya URL sendiri (bagian 6). Lupa Sandi (`/forgot-password`) dan Buat Sandi Baru (`/reset-password`) menjadi halaman tersendiri, jadi keduanya ditambahkan di bawah Autentikasi. Struktur halaman lain tidak berubah: refactor hanya memindahkan kode, mengganti dialog bawaan peramban dengan popup aplikasi, dan memperbaiki bug.

## 1. Cara membaca diagram

- **Beranda** adalah akar. Semua halaman tergantung di bawahnya lewat **garis polos** (hierarki: menu induk → halaman). Setiap halaman punya tepat satu induk.
- **Garis putus-putus** adalah **tautan silang**: tombol atau link yang membuka halaman di cabang lain tanpa mengubah induknya.
- Kotak **Autentikasi** dan **Admin** adalah judul menu (`sm-section`), bukan halaman.
- **Landing Page** adalah halaman pertama tamu (sebelum login). DUMA hanya mengizinkan satu akar, jadi Landing Page digambar sebagai menu di bawah Beranda; jalan masuk tamu ditunjukkan oleh tautan silangnya ke Log In, Sign Up, Browse Studio, Detail Studio dan Pilihan Paket.
- Setiap halaman tercapai paling banyak **tiga klik** dari Beranda.
- Tata letak: **pohon seperti sitemap lama** (`sitemap-lama.png`). Beranda di atas, delapan menu berjajar di bawahnya (Admin, Autentikasi, Landing Page, Browse Studio, Session Assistant, Booking Saya, Galeri, Account; urutan sitemap lama, dengan Autentikasi dan Landing Page di samping menu yang ditautkannya). Halaman setiap menu bertumpuk ke bawah, dan anak sebuah halaman diletakkan di kolom sebelah kanannya, mulai dari baris halaman itu (misalnya Studio Management → Session Management, Settings → Edit Profile … Privacy Policy). Posisi dihitung dari `layout-spec.json` (mode `tree`) dengan skrip skill `duma-imk-tree`.

## 2. Struktur halaman

| Menu (klik 1) | Halaman (klik 2) | Halaman (klik 3) | Frame | Isi |
|---|---|---|---|---|
| Landing Page | | | Landing Page (Desktop) `716:5558`, Landing Page (Mobile) `717:5790`, Landing - Menu Terbuka (Mobile), Landing - Pesan Terkirim (Desktop) | Halaman tamu: hero, studio, paket, kontak; tombol **Lihat Studio**, **Lihat semua paket**, Masuk / Daftar |
| Autentikasi | Log In | | — | Masuk akun; pelanggan ke Beranda (atau kembali ke Create Booking), admin ke Revenue Dashboard |
| | Sign Up | | — | Daftar akun pelanggan |
| | Lupa Sandi | | — | Isi email, **Kirim Tautan**; tautan membuat sandi baru dikirim ke email |
| | Buat Sandi Baru | | — | Dibuka dari tautan di email; password baru + ulangi, **Simpan Sandi**, lalu kembali ke Log In |
| Browse Studio | | | 1.1 | Katalog kartu studio, filter jadwal, bagian Paket dengan **Lihat semua paket**; bisa dibuka tamu |
| | Detail Studio | | 1.1.1 | Foto, deskripsi, daftar properti (hanya tampilan, tab kategori), tombol **Book Now** |
| | | Create Booking | 1.1.1.1 | Langkah 1/2 Tanggal & Waktu, langkah 2/2 Paket & Pembayaran, layar berhasil; popup galat (lihat di bawah) |
| | Pilihan Paket | | Pilihan Paket `660:5062` (nama layer "Html → Body") | Kartu paket dengan isi paket, label **Paling Favorit**, tombol **Pilih Paket Ini** (kembali ke Browse Studio) |
| Booking Saya | | | 1.2 | Tab Mendatang / Selesai |
| | Booking Details | | 1.2.1 | Detail booking + detail pembayaran, tombol Reschedule dan Batalkan |
| | | Reschedule | 1.2.1.1 | Pilih tanggal dan sesi baru, **Konfirmasi**, layar berhasil |
| | | Pembatalan & Refund | 1.2.1.2 | Alasan pembatalan, tombol **Refund**, layar Refund Berhasil / Gagal |
| Session Assistant | | | 1.3 | Layar sesi foto di studio |
| | Camera Preview & Timer | | 1.3 | Tampilan kamera, hitung mundur, pilihan timer |
| | Background | | 1.3 | Pemilih warna background, **PILIH** |
| | Pose Ideas | | — | Carousel rekomendasi pose |
| | Panggil Staff | | — | Tombol melayang + konfirmasi singkat ke staf |
| Galeri | | | — | Daftar sesi yang punya foto (Photo Locker) |
| | Album Sesi | | — | Grid foto satu sesi, pilih banyak |
| | | Preview Foto | — | Lightbox, unduh, bagikan |
| Account | | | 1.4.1 | Avatar, nama, email, menu akun |
| | Settings | | 1.4.2 | Menu pengaturan |
| | | Edit Profile | 1.4.3 | Nama, email, nomor HP, foto; **Save Changes** |
| | | Preference | 1.4.4 | Pengingat jadwal, promo, bahasa, metode tersimpan |
| | | Payment Method | — | Metode pembayaran tersimpan |
| | | Change Password | — | Ganti kata sandi |
| | | Privacy Policy | — | Kebijakan privasi |
| | Payment History | | 1.4.5 | Riwayat transaksi per bulan dengan status |
| | | Receipt | 1.4.6 | Nota digital, **Download Receipt (PDF)** |
| | Help | | — | Bantuan dan kontak customer service |
| | Konfirmasi Log Out | | 1.4.7 | Modal "Log Out of Account?" |
| Admin | | | Admin - Menu (Mobile); menu samping di setiap frame admin desktop | Judul menu admin, bukan halaman |
| | Revenue Dashboard | | Admin - Dashboard, Admin - Dashboard (Mobile) | Pendapatan hari ini / 7 hari / 30 hari / sejak awal, pendapatan 7 hari terakhir, rekapitulasi operasional (biaya dan pemasukan lain) |
| | User Management | | Admin - Pengguna, Admin - Pengguna (Mobile) | Daftar pelanggan, detail riwayat pembelian dan foto, hapus akun |
| | Studio Management | | Admin - Studio, Admin - Studio (Mobile), Admin - Studio Detail (Mobile), Tambah Studio - Form / Ringkasan Studio / Berhasil / Input Tidak Valid / Nama Sudah Digunakan / Akses Ditolak (Desktop), Konfirmasi Hapus Studio (Desktop) | Tambah studio (dengan langkah Ringkasan Studio), ubah, hapus studio |
| | | Session Management | Bagian "Detail Sesi" di Admin - Studio dan Admin - Studio Detail (Mobile), Konfirmasi Hapus Sesi (Desktop) | Kelola sesi per studio |
| | Booking Management | | Admin - Booking, Admin - Booking (Mobile), Admin - Booking Detail (Mobile), Admin - Edit Booking (Mobile), Konfirmasi Batalkan (Mobile), Konfirmasi Hapus (Mobile), Konfirmasi Hapus Booking (Desktop) | Daftar, detail, ubah, hapus booking |
| | Property Management | | Admin - Properti, Admin - Properti (Mobile), Admin - Properti Detail (Mobile), Konfirmasi Hapus Properti (Desktop) | Kelola properti/aksesoris studio |
| | Pose Management | | Admin - Pose, Admin - Pose (Mobile) | Kelola rekomendasi pose per jumlah orang |
| | Payment Dashboard | | Admin - Transaksi, Admin - Transaksi (Mobile) | Total pembayaran masuk dan refund, daftar transaksi dengan status |
| | Package Management | | Admin - Paket & Diskon, Admin - Paket & Diskon (Mobile) | Diskon utama, tambah / ubah / nonaktifkan / hapus paket |
| | Admin Account | | Admin - Akun Admin, Admin - Akun Admin (Mobile) | Ganti username dan password admin |

Langkah di dalam satu alur (Tanggal & Waktu → Paket & Pembayaran → Berhasil, atau Refund Berhasil/Gagal) digambar sebagai **satu halaman**, karena pengguna tidak membukanya dari menu. Begitu juga empat bagian Session Assistant: semuanya panel di satu layar sesi, tetapi tetap digambar sebagai anak karena masing-masing tugas tersendiri di HTA (2.1, 2.1.1, 2.1.2).

**Popup bukan halaman.** Popup galat Create Booking adalah bagian dari halaman Create Booking: Input Tidak Valid `585:3886`, Sesi Tidak Tersedia `585:4061`, Paket Tidak Ditemukan `585:4251`, Sesi Sudah Dibooking `585:4358`, Belum Login `585:4400`. Popup Paket Foto Tidak Ditemukan `660:5538` muncul dari Browse Studio / Book Now. Di sisi admin, langkah Ringkasan Studio, dialog Akses Ditolak dan dialog Konfirmasi Hapus termasuk halaman menunya masing-masing. Tombol popup yang membuka halaman lain digambar sebagai tautan silang (bagian 3).

## 3. Tautan silang

| Dari | Ke | Alasan |
|---|---|---|
| Landing Page | Log In | Tombol "Masuk" di navbar landing |
| Landing Page | Sign Up | Tombol "Daftar" di navbar landing |
| Landing Page | Browse Studio | Tombol "Lihat Studio"; tamu boleh melihat studio tanpa login |
| Landing Page | Detail Studio | Kartu studio di landing membuka Detail Studio |
| Landing Page | Pilihan Paket | Link "Lihat semua paket" di bagian paket |
| Log In | Sign Up | Link "belum punya akun?" |
| Sign Up | Log In | Link "sudah punya akun?" |
| Log In | Lupa Sandi | Link "Lupa sandi?" di bawah form masuk |
| Lupa Sandi | Log In | Tombol "Kembali" |
| Buat Sandi Baru | Log In | Setelah sandi disimpan, website membuka Log In dengan pesan "Sandi berhasil diubah" |
| Log In | Admin | Akun dengan peran admin diarahkan ke menu Admin (Revenue Dashboard) |
| Pilihan Paket | Browse Studio | "Pilih Paket Ini" menyimpan paket lalu kembali ke Browse Studio untuk memilih studio |
| Create Booking | Pilihan Paket | Popup Paket Tidak Ditemukan, tombol "Lihat & Pilih Paket Lain" |
| Create Booking | Log In | Popup Belum Login saat tamu menekan Check Out, tombol "Masuk"; setelah login, Create Booking dilanjutkan di langkah yang sama |
| Create Booking | Booking Saya | Dari layar berhasil, melihat booking yang baru dibuat |
| Booking Saya | Browse Studio | Membuat booking baru (studio dipilih dulu); menggantikan "Create Booking" ganda di sitemap lama |
| Booking Details | Session Assistant | Membuka sesi foto dari booking yang sedang berlangsung |
| Booking Details | Album Sesi | Melihat foto dari booking yang sudah selesai |
| Pembatalan & Refund | Help | Tombol "Hubungi Customer Service" saat refund gagal |
| Account | Edit Profile | Ikon edit di samping nama |
| Preference | Payment Method | Pengaturan "Saved Method" |
| Konfirmasi Log Out | Landing Page | Setelah keluar, website kembali ke Landing Page |

## 4. Perubahan dari sitemap lama

| Sitemap lama | Sitemap baru | Alasan |
|---|---|---|
| Nomor `5,1 Galeri` dan `5.1 Account` kembar, `6.1 Admin` | Nomor dibuang dari label; frame dicatat di tabel bagian 2 | Nomor lama kembar dan tidak sama dengan nomor frame Figma |
| Browse → Session → Create Booking | Browse Studio → Detail Studio → Create Booking | Alurnya studio dulu, lalu sesi dipilih di dalam Create Booking (frame 1.1.1, 1.1.1.1) |
| My Booking → Delete Booking, Create Booking | Booking Saya → Booking Details → Reschedule, Pembatalan & Refund; tautan silang ke Browse Studio | Pelanggan tidak menghapus booking, tetapi menjadwal ulang atau membatalkan dengan refund (HTA 1.2, 1.3); Create Booking tidak boleh muncul dua kali |
| Session Assistant: Camera Preview & Timer, Background, CS (Customer Service) | Ditambah Pose Ideas; CS menjadi Panggil Staff | Rekomendasi pose ada di HTA dan desain interaksi Modul 2; "Panggil Staff" adalah label tombol di desain |
| Galeri tanpa anak | Galeri → Album Sesi → Preview Foto | HTA 3.1–3.4 (pilih sesi, preview, unduh, bagikan) |
| Account → Sign Up, Log In, Settings, Payment History, Logout | Sign Up dan Log In pindah ke menu Autentikasi; Account → Settings, Payment History, Help, Konfirmasi Log Out | Halaman Account hanya terbuka setelah login, jadi Log In dan Sign Up tidak bisa ada di bawahnya; Help ada di frame 1.4.1 |
| Settings → Preference, Edit Profile | Ditambah Payment Method, Change Password, Privacy Policy | Semua tercantum di frame Settings (1.4.2) |
| Payment History → Digital Receipt | Payment History → Receipt | Nama mengikuti frame 1.4.6 |
| Admin: User, Studio, Pose, Booking, Property Management, Payment Dashboard | Ditambah Session Management di bawah Studio Management | Admin membuat sesi per studio; ejaan "Pose Managment" diperbaiki |
| Tidak ada halaman tamu | **Landing Page** sebagai menu pertama, dengan tautan silang ke Log In, Sign Up, Browse Studio, Detail Studio, Pilihan Paket | Website dan Figma (`716:5558`, `717:5790`) membuka Landing Page untuk tamu; tamu boleh melihat studio, paket dan mengisi Create Booking, lalu login sebelum pembayaran |
| Tidak ada halaman paket | **Pilihan Paket** di bawah Browse Studio, tautan silang balik ke Browse Studio | Website dan Figma `660:5062`; alurnya tetap studio dulu |
| Admin tanpa paket, dasbor pendapatan dan akun admin | Ditambah **Revenue Dashboard**, **Package Management** (Paket & Diskon) dan **Admin Account**; urutan halaman Admin mengikuti menu website | Ketiganya menu di website; frame-nya dibuat di fase 7 |
| Kolom Frame Admin "—" | Diisi nama frame Figma | Frame admin ada di halaman `64:2` (yang lama dari kelompok, enam yang baru dari fase 7) |
| Konfirmasi Log Out → Log In | Konfirmasi Log Out → Landing Page | Website kembali ke Landing Page setelah keluar |
| Autentikasi hanya Log In dan Sign Up | Ditambah **Lupa Sandi** dan **Buat Sandi Baru** | Sejak refactor MVC keduanya halaman tersendiri dengan URL `/forgot-password` dan `/reset-password` (sebelumnya mode di dalam form masuk) |

## 5. Asumsi dan celah

- **Beranda** dianggap akar aplikasi (frame bernomor 1.x), dengan Browse Studio sebagai halaman katalog di bawahnya, sama seperti sitemap lama. Kalau kelompok menganggap Beranda adalah katalog itu sendiri, Browse Studio bisa digabung ke Beranda dan semua halaman jadi satu klik lebih dangkal.
- **Landing Page** sebenarnya dibuka sebelum Beranda, tetapi DUMA hanya menerima satu akar (`sm-home`). Menjadikan Landing Page akar akan membuat Receipt empat klik dalamnya, jadi Landing Page digambar sebagai menu di bawah Beranda dan perannya sebagai pintu masuk tamu ditulis di catatan diagram.
- **Revenue Dashboard** dan **Admin Account** tidak ada di daftar keputusan sitemap (keputusan 14), tetapi ditambahkan karena website punya menu Dashboard dan Akun Admin dan setiap menu admin sekarang punya frame. **Payment Dashboard** dipertahankan namanya dan dipetakan ke halaman Transaksi (total pembayaran masuk dan refund).
- Halaman bertanda **—** di kolom Frame belum punya frame di Figma: Log In, Sign Up, Lupa Sandi, Buat Sandi Baru, Galeri dan turunannya, Pose Ideas, Panggil Staff, Help, Payment Method, Change Password, Privacy Policy. Halaman itu tetap dimasukkan karena ada di HTA, desain interaksi, atau menu di frame lain. Brief akhir meminta link antarhalaman berfungsi, jadi halaman yang tetap di sitemap perlu dibuatkan frame atau dikeluarkan dari sitemap.
- Enam frame admin baru (Admin - Dashboard, Pengguna, Pose, Transaksi, Paket & Diskon, Akun Admin; desktop dan mobile) dibuat dari kode website dengan data demo. Menu samping desktop di frame baru berisi sembilan menu seperti website, sedangkan frame admin lama masih menampilkan enam menu.
- Tautan silang Booking Details → Session Assistant dan Booking Details → Album Sesi adalah asumsi; frame Booking Details hanya menampilkan Reschedule dan Batalkan.
- Label mengikuti frame, jadi campur bahasa Inggris dan Indonesia (frame akun dan admin berbahasa Inggris di sitemap, Indonesia di layar).
- Bagikan foto memakai share sheet bawaan perangkat, jadi tidak digambar sebagai situs luar.
- Email ke Buat Sandi Baru tidak digambar sebagai tautan silang dari Lupa Sandi (atau dari "Ubah sandi" di Pengaturan Akun website, yang mengirim tautan yang sama), karena pengguna membukanya dari kotak masuk email, bukan dengan klik di website. Catatan diagram menyebutkannya.

## 6. URL halaman (refactor MVC)

Sejak refactor MVC frontend setiap halaman website punya path sendiri: muat ulang, tombol back/forward dan link yang dibagikan membuka halaman yang sama. Daftar lengkap rute ada di `../../frontend/js/core/router.js` (`ROUTES`); penjelasannya di `../../frontend/ARCHITECTURE.md` bagian Rute. Halaman sitemap yang hanya ada di Figma diberi tanda —.

| Halaman sitemap | Path | Akses |
|---|---|---|
| Landing Page | `/` | semua |
| Log In / Sign Up | `/login`, `/register` | tamu |
| Lupa Sandi | `/forgot-password` | tamu |
| Buat Sandi Baru | `/reset-password` (tautan email `/#reset=<token>` diubah ke path ini) | tamu |
| Browse Studio | `/browse` | tamu + pelanggan |
| Pilihan Paket | `/packages` | tamu + pelanggan |
| Detail Studio | `/studios/:id` | tamu + pelanggan |
| Create Booking | `/book/time` (Tanggal & Waktu), `/book/pay` (Paket & Pembayaran), `/bookings/:id/success` (berhasil, pelanggan) | tamu + pelanggan |
| Booking Saya | `/bookings` (tab Riwayat: `?tab=history`) | pelanggan |
| Booking Details | `/bookings/:id` | pelanggan |
| Reschedule | `/bookings/:id/reschedule`, `/bookings/:id/rescheduled` (berhasil) | pelanggan |
| Pembatalan & Refund | `/bookings/:id/cancel`, `/bookings/:id/refund` (hasil) | pelanggan |
| Session Assistant (+ Camera Preview & Timer, Background, Pose Ideas, Panggil Staff) | `/sessions/:id` (satu layar) | pelanggan |
| Galeri (+ Album Sesi, Preview Foto) | `/gallery` (satu layar) | pelanggan |
| Account / Edit Profile | `/account` (Pengaturan Akun, tab Edit Profil) | pelanggan |
| Payment History | `/account/payments` (tab Riwayat Pembayaran) | pelanggan |
| Konfirmasi Log Out | — (tombol Keluar di `/account`, lalu `/`) | pelanggan |
| Settings, Preference, Payment Method, Change Password, Privacy Policy, Receipt, Help | — | — |
| Revenue Dashboard | `/admin` | admin |
| User Management | `/admin/users` | admin |
| Studio Management (+ Session Management) | `/admin/studios` (Detail Sesi di halaman yang sama) | admin |
| Booking Management | `/admin/bookings` | admin |
| Property Management | `/admin/props` | admin |
| Pose Management | `/admin/poses` | admin |
| Payment Dashboard | `/admin/transactions` | admin |
| Package Management | `/admin/packages` | admin |
| Admin Account | `/admin/account` | admin |

Penjaga rute: tamu yang membuka halaman pelanggan atau admin diarahkan ke `/`; pelanggan di halaman admin ke `/browse`; admin di halaman pelanggan ke `/admin`; path yang tidak dikenal ke beranda pengguna (`/`, `/browse` atau `/admin`).
