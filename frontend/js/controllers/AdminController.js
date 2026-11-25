// AdminController: inti panel admin (dulu aLoad, aDo, aAuthErr, aDenied, aModal di admin.js) dan halaman admin umum.
// - load(key, request, fallback): muat sekali ke slice admin (penanda loading), galat lewat handleError
// - run(action, okMessage, what, { draft }): aksi admin dengan toast hasil; galat lewat handleError, isian form yang gagal disimpan sebagai draf
// - handleError: 401 → keluar; 403 "Hanya admin" → dialog Akses ditolak; 403 "Ganti password" → Akun Admin; selain itu toast galat
// logout = AuthController.logout (main.js). Halaman Studio, Booking, Properti dan Pose masih kode lama (fase 8b) dan memakai inti ini lewat CONTROLLERS.admin.
import { DEFAULT_DENIED, accessDeniedModal, confirmModal, deleteCustomerBody, deleteOperationBody } from "../views/admin/dialogs.js";

// isi awal slice admin (dulu objek AD dan adminReset); kunci tanpa nama lengkap masih milik kode lama fase 8b
export function createAdminState() {
  return {
    me: null,
    loading: {},
    drafts: {},
    query: "",
    revenue: null,
    operations: null,
    operationsPeriod: "month",
    editingOperation: null,
    customers: null,
    customerDetail: null,
    transactions: null,
    packages: null,
    discount: null,
    // kode lama fase 8b (studio + sesi, booking, properti, pose)
    imgs: {},
    open: {},
    studios: null,
    books: null,
    props: null,
    poses: null,
    bdet: null,
    bst: null,
    bstatus: "",
    scal: {},
    sday: {},
    sess: {},
    sedit: null,
    sadd: null,
    stnew: null,
    stsum: null,
    sterr: null,
    stdone: null,
  };
}

export function createAdminController({ api, store, ui, router, models, logout }) {
  const state = () => store.get();
  const admin = () => state().admin;
  const pages = models.admin;
  // dialog Akses ditolak yang sedang terbuka (handleError, load dan run menunggunya selesai)
  let denial = Promise.resolve();

  function setToast(toast, { silent = true } = {}) {
    store.update("runtime", { toast: { message: "", error: "", ...toast } }, { silent });
  }

  // drafts tanpa satu form (setelah berhasil disimpan atau form dibuka ulang)
  function withoutDraft(key) {
    const { [key]: dropped, ...rest } = admin().drafts;
    return rest;
  }

  function setLoading(key, flag) {
    store.update("admin", { loading: { ...admin().loading, [key]: flag } }, { silent: true });
  }

  const controller = {
    // galat akses (dulu aAuthErr + alur "Ganti password"): true bila sudah ditangani
    handleAccessError(error, what) {
      if (error.status == 401) {
        logout();
        return true;
      }
      if (error.status == 403 && /Hanya admin/.test(error.message)) {
        denial = controller.showAccessDenied(what);
        return true;
      }
      if (error.status == 403 && /Ganti password/.test(error.message)) {
        const me = admin().me;
        if (me) {
          store.update("admin", { me: { ...me, must_change: true } }, { silent: true });
        }
        router.navigate("/admin/account");
        return true;
      }
      return false;
    },

    // galat lain = toast galat, login tetap
    async handleError(error, what) {
      if (controller.handleAccessError(error, what)) {
        return denial;
      }
      setToast({ error: error.message }, { silent: false });
    },

    // dialog Akses ditolak: keluar dulu (data admin tidak tertinggal di balik dialog); Escape / klik di luar → form masuk
    async showAccessDenied(what = DEFAULT_DENIED) {
      if (state().runtime.accessDeniedOpen) {
        return;
      }
      store.update("runtime", { accessDeniedOpen: true }, { silent: true });
      logout();
      const answer = await ui.modal(accessDeniedModal(what));
      store.update("runtime", { accessDeniedOpen: false }, { silent: true });
      if (answer !== "home") {
        router.navigate("/login");
      }
    },

    // konfirmasi "Konfirmasi Hapus …": true hanya bila tombol aksi ditekan
    async confirm({ title, body, okLabel }) {
      return (await ui.modal(confirmModal({ title, body, okLabel }))) === true;
    },

    async load(key, request, fallback) {
      if (admin()[key] || admin().loading[key]) {
        return;
      }
      setLoading(key, true);
      let value;
      try {
        value = await request();
      } catch (error) {
        setLoading(key, false);
        if (controller.handleAccessError(error)) {
          return denial;
        }
        setToast({ error: error.message });
        value = fallback;
      }
      store.update("admin", { [key]: value, loading: { ...admin().loading, [key]: false } });
    },

    // aksi: toast lama dihapus; okMessage menggantikan toast yang diisi aksi sendiri. true = berhasil
    async run(action, okMessage = "", what, { draft } = {}) {
      setToast({});
      store.update("admin", { stdone: null }, { silent: true });
      try {
        await action();
      } catch (error) {
        if (controller.handleAccessError(error, what)) {
          await denial;
          return false;
        }
        if (draft) {
          store.update("admin", { drafts: { ...admin().drafts, [draft.key]: draft.values } }, { silent: true });
        }
        setToast({ error: error.message }, { silent: false });
        return false;
      }
      const toast = state().runtime.toast;
      setToast(okMessage ? { message: okMessage } : toast, { silent: false });
      return true;
    },

    // kotak cari di header admin (data-change="admin:search")
    setSearch(query) {
      store.update("admin", { query });
    },

    // ---------- Dashboard (/admin) ----------
    loadDashboard() {
      return Promise.all([controller.load("revenue", () => pages.dashboard.loadRevenue(api), {}), controller.load("operations", () => pages.dashboard.loadOperations(api, admin().operationsPeriod), { period: "", items: [] })]);
    },

    // periode rekap: rekap dikosongkan lalu dimuat ulang oleh kait after halaman
    setOperationsPeriod(period) {
      store.update("admin", { operationsPeriod: period, operations: null });
    },

    editOperation({ id }) {
      const item = admin().operations.items.find(entry => entry.id == id);
      store.update("admin", { editingOperation: item, drafts: withoutDraft("operation") });
      ui.scrollToEnd();
    },

    cancelOperationEdit() {
      store.update("admin", { editingOperation: null, drafts: withoutDraft("operation") });
    },

    // values = isian form Tambah/Ubah item (data-submit, formValues)
    saveOperation(values) {
      const editing = admin().editingOperation;
      return controller.run(
        async () => {
          await pages.dashboard.saveOperation(api, editing && editing.id, pages.dashboard.operationBody(values));
          store.update("admin", { editingOperation: null, operations: null, drafts: withoutDraft("operation") }, { silent: true });
        },
        "Rekap operasional disimpan.",
        undefined,
        { draft: { key: "operation", values } },
      );
    },

    async deleteOperation({ id }) {
      if (!(await controller.confirm({ title: "Konfirmasi Hapus Item Rekap", body: deleteOperationBody(), okLabel: "Ya, Hapus Item" }))) {
        return;
      }
      await controller.run(async () => {
        await pages.dashboard.deleteOperation(api, id);
        store.update("admin", { operations: null, editingOperation: null }, { silent: true });
      }, "Item dihapus.");
    },

    // ---------- Pengguna (/admin/users) ----------
    loadUsers() {
      return controller.load("customers", () => pages.users.loadCustomers(api), []);
    },

    async openCustomer({ id }) {
      const opened = await controller.run(async () => {
        store.update("admin", { customerDetail: await pages.users.loadCustomerDetail(api, id) }, { silent: true });
      });
      if (opened) {
        ui.scrollToEnd();
      }
    },

    closeCustomer() {
      store.update("admin", { customerDetail: null });
    },

    // hapus akun beserta seluruh booking, pembayaran dan fotonya; data turunan (ringkasan, studio, booking, transaksi) dimuat ulang
    deleteCustomer({ id, name }) {
      return controller.run(async () => {
        const answer = await pages.confirmable.withConfirm(confirmed => pages.users.deleteCustomer(api, id, confirmed), { ui, title: "Konfirmasi Hapus Akun", okLabel: "Ya, Hapus Akun", describeImpact: () => deleteCustomerBody(name), known: null });
        if (!answer) {
          return;
        }
        store.update("admin", { customers: null, customerDetail: null, revenue: null, operations: null, studios: null, books: null, transactions: null, sess: {} }, { silent: true });
        setToast({ message: `Akun dihapus (${answer.photos_deleted} foto ikut terhapus).` });
      });
    },

    // ---------- Transaksi (/admin/transactions) ----------
    loadTransactions() {
      return controller.load("transactions", () => pages.transactions.loadTransactions(api), { rows: [], paid: 0, refunded: 0 });
    },
  };
  return controller;
}
