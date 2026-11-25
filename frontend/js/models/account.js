// Akun pelanggan: ubah profil dan riwayat pembayaran (dulu saveProfile dan isi tab Riwayat Pembayaran di customer.js).
// Murni; api diberikan pemanggil.

// jawaban = { id, name, email, phone } terbaru
export function updateProfile(api, { name, phone }) {
  return api.patch("/me", { name, phone });
}

// pembayaran yang pernah terjadi (lunas, refunded, refund gagal), terbaru dulu; daftar asli tidak diubah
export function paymentHistory(bookings) {
  return bookings.filter(booking => booking.pay_status && !["pending", "batal"].includes(booking.pay_status)).sort((first, second) => (second.paid_at || 0) - (first.paid_at || 0));
}
