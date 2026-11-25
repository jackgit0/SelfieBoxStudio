// Transaksi: semua pembayaran dengan total masuk dan total refund.

export function loadTransactions(api) {
  return api.get("/admin/transactions");
}
