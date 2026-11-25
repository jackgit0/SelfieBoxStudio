// Pengguna (pelanggan) di panel admin: daftar, detail (riwayat pembelian + foto) dan hapus akun beserta seluruh datanya.
import { confirmPath } from "./confirmable.js";

export function loadCustomers(api) {
  return api.get("/admin/customers");
}

export async function loadCustomerDetail(api, id) {
  const [history, photos] = await Promise.all([
    api.get(`/admin/customers/${id}/bookings`),
    api.get(`/admin/customers/${id}/photos`),
  ]);
  return { customer: history.customer, bookings: history.bookings, photos: photos.photos };
}

// confirmed = ulangi dengan ?confirm=1 (withConfirm; server saat ini tidak meminta konfirmasi untuk akun)
export function deleteCustomer(api, id, confirmed = false) {
  const path = "/admin/customers/" + id;
  return api.del(confirmed ? confirmPath(path) : path);
}
