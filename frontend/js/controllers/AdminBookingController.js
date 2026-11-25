// AdminBookingController (tabel MVC APS): Daftar Booking admin, saringan status, panel Detail Booking, ubah paket/status, hapus
// (dulu V.abook_after, openBook, bookSave, bookFail, bookAfter, bookDel di admin.js). Aksi lewat AdminController (admin.run / admin.load).
import { cancelBookingBody, deleteBookingBody, statusChangeBody } from "../views/admin/dialogs.js";
import { formatRupiah } from "../core/format.js";
import { CANCELLED } from "./AdminController.js";

// admin = AdminController (run, load, confirm); ui.revealBookingDetail() = gulir ke panel detail di layar sempit
export function createAdminBookingController({ api, store, ui, models, admin: adminCore }) {
  const bookingModel = models.admin.bookings;
  const adminState = () => store.get().admin;

  function updateAdmin(patch, { silent = true } = {}) {
    store.update("admin", patch, { silent });
  }

  function setToast(toast, { silent = true } = {}) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } }, { silent });
  }

  function withoutDraft(key) {
    const { [key]: dropped, ...rest } = adminState().drafts;
    return rest;
  }

  async function reloadDetail(id) {
    return bookingModel.loadBooking(api, id).catch(() => null);
  }

  // aksi gagal (mis. booking berubah sementara itu): detail terbaru tampil, daftar dimuat ulang, galat diteruskan ke admin.run
  async function failWith(id, error) {
    updateAdmin({ bookingDetail: await reloadDetail(id), bookings: null });
    throw error;
  }

  // booking berubah: daftar, ringkasan, studio (jumlah sesi), pelanggan dan sesi studio tertaut ikut dimuat ulang
  function invalidateAfterChange() {
    updateAdmin({
      bookings: null,
      revenue: null,
      operations: null,
      transactions: null,
      studios: null,
      customers: null,
      customerDetail: null,
      sessions: {},
    });
  }

  const controller = {
    // kait after halaman: daftar dengan saringan status; panel detail yang terbuka ikut diperbarui (booking bisa berubah/terhapus dari halaman lain)
    load() {
      return adminCore.load(
        "bookings",
        async () => {
          const list = await bookingModel.loadBookings(api, adminState().bookingFilter);
          const openId = adminState().bookingDetail && adminState().bookingDetail.id;
          if (openId) {
            const fresh = await reloadDetail(openId);
            if (adminState().bookingDetail && adminState().bookingDetail.id == openId) {
              updateAdmin({ bookingDetail: fresh });
            }
          }
          return list;
        },
        [],
      );
    },

    setFilter(dataset, event) {
      updateAdmin({ bookingFilter: event.target.value, bookings: null, bookingDetail: null }, { silent: false });
    },

    // membuka booking (juga booking lain) menutup form Ubah Booking yang masih terbuka
    async open({ id }) {
      adminCore.stopEditing();
      const opened = await adminCore.run(async () => {
        updateAdmin({ drafts: withoutDraft("booking-" + id), bookingDetail: await bookingModel.loadBooking(api, id) });
      });
      if (opened) {
        ui.revealBookingDetail();
      }
    },

    close() {
      adminCore.stopEditing();
      updateAdmin({ bookingDetail: null }, { silent: false });
    },

    // Check-in di meja depan (pelanggan sudah datang): sesi kemudian dimulai dari tablet studio
    checkIn({ id }) {
      return adminCore.run(async () => {
        const answer = await models.admin.liveSession.checkIn(api, id).catch(error => failWith(id, error));
        updateAdmin({ bookingDetail: answer, bookings: null });
        setToast({ message: `Check-in berhasil. Sesi dapat dimulai dari tablet ${answer.studio_name}.` });
      });
    },

    // values = { status, package_id } dari form Ubah Booking; paket hanya sebelum dibayar, status hanya ke tujuan server.
    // Dibatalkan / Sesi Berjalan / Selesai minta konfirmasi dulu; batal → pilihan tetap (draf)
    async save({ id }, values) {
      const detail = adminState().bookingDetail;
      if (!detail || detail.id != id) {
        return false;
      }
      const draftKey = "booking-" + id;
      const body = bookingModel.changeBody(detail, values);
      if (!Object.keys(body).length) {
        setToast({ error: "Tidak ada perubahan." }, { silent: false });
        return false;
      }
      const hours = bookingModel.slotHours(detail.slot);
      return adminCore.run(
        async () => {
          let confirmed = true;
          if (body.status == "Dibatalkan") {
            confirmed = await adminCore.confirm({
              title: "Batalkan booking ini?",
              body: cancelBookingBody(detail, hours),
              okLabel: "Ya, Batalkan Booking",
            });
          } else if (["Sesi Berjalan", "Selesai"].includes(body.status)) {
            confirmed = await adminCore.confirm({
              title: `Ubah status menjadi ${body.status}?`,
              body: statusChangeBody(body.status),
              okLabel: "Ya, Ubah Status",
            });
          }
          if (!confirmed) {
            updateAdmin({ drafts: { ...adminState().drafts, [draftKey]: values } });
            return CANCELLED;
          }
          const answer = await bookingModel.updateBooking(api, id, body).catch(error => failWith(id, error));
          invalidateAfterChange();
          updateAdmin({ bookingDetail: answer, drafts: withoutDraft(draftKey) });
          adminCore.stopEditing();
          if (answer.refund && answer.refund.state == "failed") {
            setToast({ error: "Booking dibatalkan, tetapi refund gagal. Tindak lanjuti secara manual." });
          } else {
            const refunded =
              answer.refund && answer.refund.state == "refunded"
                ? ` Dana ${formatRupiah(answer.refund.amount)} dikembalikan 100%.`
                : "";
            setToast({
              message:
                "Booking diperbarui." + refunded + (answer.notified ? " Pelanggan diberi tahu lewat email." : ""),
            });
          }
        },
        "",
        undefined,
        { draft: { key: draftKey, values } },
      );
    },

    // hapus booking (US-16, Figma "Konfirmasi Hapus Booking"): refund lebih dulu; refund gagal → booking disimpan (kept) dan galat tampil
    delete({ id }) {
      const detail = adminState().bookingDetail;
      if (!detail || detail.id != id) {
        return Promise.resolve(false);
      }
      const hours = bookingModel.slotHours(detail.slot);
      return adminCore.run(async () => {
        const answer = await models.admin.confirmable
          .withConfirm(confirmed => bookingModel.deleteBooking(api, id, confirmed), {
            ui,
            title: "Hapus booking ini?",
            okLabel: "Ya, Hapus Booking",
            describeImpact: impact => deleteBookingBody(detail, hours, impact),
            known: detail.impact,
          })
          .catch(error => failWith(id, error));
        if (!answer) {
          return CANCELLED;
        }
        invalidateAfterChange();
        if (answer.kept) {
          updateAdmin({ bookingDetail: await reloadDetail(id) });
          setToast({ error: answer.message + "." });
          return;
        }
        updateAdmin({ bookingDetail: null });
        setToast({
          message:
            answer.refund == "refunded"
              ? `Booking dihapus. Dana ${formatRupiah(answer.refund_amount)} dikembalikan 100%.`
              : "Booking dihapus.",
        });
      });
    },
  };
  return controller;
}
