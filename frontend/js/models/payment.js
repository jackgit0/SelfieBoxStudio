// Pembayaran booking (simulasi, tanpa Midtrans) dan invoice lewat email. Murni; api diberikan pemanggil.

export function pay(api, id, method) {
  return api.post(`/bookings/${id}/pay`, { method });
}

// jawaban { dev: true } = SMTP belum diatur, email disimpan di backend/outbox
export function emailInvoice(api, id) {
  return api.post(`/bookings/${id}/invoice/email`);
}
