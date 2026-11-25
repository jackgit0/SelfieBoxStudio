// Autentikasi: lupa sandi (dipakai juga oleh Ubah Sandi di Pengaturan Akun). Murni; api diberikan pemanggil.

// tautan buat sandi baru dikirim ke email (jawaban { message })
export function forgot(api, email) {
  return api.post("/auth/forgot", { email });
}
