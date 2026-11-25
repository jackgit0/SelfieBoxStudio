// Akun Admin: ganti username dan/atau password (password saat ini wajib). Jawaban = { token, username }: token baru,
// karena sesi admin lama keluar setelah password diganti.

export function saveAccount(api, { username, current_password, new_password }) {
  return api.patch("/admin/account", { current_password, username, new_password: new_password || undefined });
}
