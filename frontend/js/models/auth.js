// Autentikasi pelanggan dan admin (dulu reg, login, adminLogin, forgot, doReset di core.js dan boot.js).
// Murni; api diberikan pemanggil. Jawaban masuk = { token, user } (pelanggan) atau { token, admin } (admin).

export function register(api, { name, email, phone, password }) {
  return api.post("/auth/register", { name, email, phone, password });
}

export function login(api, { email, password }) {
  return api.post("/auth/login", { email, password });
}

// username admin tidak boleh memuat "@" (satu form masuk untuk keduanya)
export function adminLogin(api, { username, password }) {
  return api.post("/admin/login", { username, password });
}

// tautan buat sandi baru dikirim ke email (jawaban { message }); dipakai juga oleh Ubah Sandi di Pengaturan Akun
export function forgot(api, email) {
  return api.post("/auth/forgot", { email });
}

// token = 64 hex dari tautan email /#reset=<token>
export function reset(api, { token, password }) {
  return api.post("/auth/reset", { token, password });
}

// akun admin yang sedang masuk; 403 "Hanya admin" bila token yang tersimpan milik pelanggan
export function adminMe(api) {
  return api.get("/admin/me");
}
