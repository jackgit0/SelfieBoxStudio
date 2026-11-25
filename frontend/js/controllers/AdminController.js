// AdminController: inti panel admin (dulu aLoad, aDo, aAuthErr, aDenied, aModal di admin.js) dan halaman admin umum.
// - load(key, request, fallback): muat sekali ke slice admin (penanda loading), galat lewat handleError
// - run(action, okMessage, what, { draft }): aksi admin dengan toast hasil; galat lewat handleError, isian form yang gagal disimpan sebagai draf
// - handleError: 401 → keluar; 403 "Hanya admin" → dialog Akses ditolak; 403 "Ganti password" → Akun Admin; selain itu toast galat
// logout = AuthController.logout (main.js). Studio + Detail Sesi = StudioController, Booking = AdminBookingController (memakai inti ini);
// Properti dan Pose di sini (fase 8b). files.readImage(file) → data URL yang sudah diperkecil (components/imageFile.js)
import { DEFAULT_DENIED, accessDeniedModal, confirmModal, deleteCustomerBody, deleteOperationBody, deletePackageBody, deletePoseBody, deletePropertyBody } from "../views/admin/dialogs.js";

// isi awal slice admin (dulu objek AD dan adminReset)
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
    // Studio + Detail Sesi (StudioController): daftar, accordion terbuka (id / "new"), gambar yang baru diunggah (id / "new" / "property-<id>"),
    // isian Tambah Studio, langkah Ringkasan, galat isian, kartu Berhasil; sesi per "<studio>|<bulan>", bulan dan hari per studio, form sesi terbuka
    studios: null,
    openStudios: {},
    images: {},
    newStudio: null,
    studioSummary: false,
    studioErrors: null,
    studioDone: null,
    sessions: {},
    sessionMonths: {},
    sessionDays: {},
    editingSession: null,
    addingSessionFor: null,
    // Booking (AdminBookingController): daftar, saringan status, panel detail
    bookings: null,
    bookingFilter: "",
    bookingDetail: null,
    // Properti dan Pose
    properties: null,
    poses: null,
  };
}

export function createAdminController({ api, store, ui, router, models, logout, files = null }) {
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
      store.update("admin", { studioDone: null }, { silent: true });
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
        store.update("admin", { customers: null, customerDetail: null, revenue: null, operations: null, studios: null, bookings: null, transactions: null, sessions: {} }, { silent: true });
        setToast({ message: `Akun dihapus (${answer.photos_deleted} foto ikut terhapus).` });
      });
    },

    // ---------- Transaksi (/admin/transactions) ----------
    loadTransactions() {
      return controller.load("transactions", () => pages.transactions.loadTransactions(api), { rows: [], paid: 0, refunded: 0 });
    },

    // ---------- Paket & Diskon (/admin/packages) ----------
    loadPackagesPage() {
      return Promise.all([controller.load("packages", () => pages.packages.loadPackages(api), []), controller.load("discount", () => pages.packages.loadDiscount(api), { pct: 0, label: "" })]);
    },

    // values = isian baris paket (form package-form-<id>)
    savePackage({ id }, values) {
      return savePackageForm("package-" + id, values, () => pages.packages.savePackage(api, id, pages.packages.packageBody(values)), "Paket disimpan. Harga baru berlaku untuk booking berikutnya.");
    },

    addPackage(values) {
      return savePackageForm("package-new", values, () => pages.packages.addPackage(api, pages.packages.packageBody(values)), "Paket baru ditambahkan.");
    },

    activatePackage({ id }) {
      return controller.run(async () => {
        await pages.packages.activatePackage(api, id);
        store.update("admin", { packages: null }, { silent: true });
      }, "Paket diaktifkan.");
    },

    async deletePackage({ id }) {
      if (!(await controller.confirm({ title: "Konfirmasi Hapus Paket", body: deletePackageBody(), okLabel: "Ya, Hapus Paket" }))) {
        return;
      }
      await controller.run(async () => {
        const answer = await pages.packages.deletePackage(api, id);
        store.update("admin", { packages: null }, { silent: true });
        setToast({ message: answer.deactivated ? "Paket pernah dibeli, jadi dinonaktifkan (riwayat tetap utuh)." : "Paket dihapus." });
      });
    },

    saveDiscount(values) {
      return controller.run(
        async () => {
          await pages.packages.saveDiscount(api, pages.packages.discountBody(values));
          store.update("admin", { discount: null, drafts: withoutDraft("discount") }, { silent: true });
        },
        "Diskon utama disimpan.",
        undefined,
        { draft: { key: "discount", values } },
      );
    },

    // ---------- Properti (/admin/props) ----------
    loadProperties() {
      return controller.load("properties", () => pages.properties.loadProperties(api), []);
    },

    // values = isian baris (form property-form-<id>); gambar baru dari admin.images["property-<id>"]
    saveProperty({ id }, values) {
      return savePropertyForm(id, values);
    },

    addProperty(values) {
      return savePropertyForm(null, values);
    },

    // foto baris properti (data-change pada input file berform=): isian baris saat itu disimpan sebagai draf agar tidak hilang saat dirender ulang
    async uploadPropertyImage({ key }, file, values = {}) {
      if (!file) {
        return;
      }
      setToast({});
      store.update("admin", { drafts: { ...admin().drafts, ["property-" + key]: values } }, { silent: true });
      try {
        const url = await pages.uploads.uploadImage(api, await files.readImage(file));
        store.update("admin", { images: { ...admin().images, ["property-" + key]: url } }, { silent: true });
        setToast({ message: "Gambar diunggah. Klik Simpan untuk menerapkan." });
      } catch (error) {
        setToast({ error: error.message });
      }
      store.update("admin", {});
    },

    async deleteProperty({ id }) {
      if (!(await controller.confirm({ title: "Konfirmasi Hapus Properti", body: deletePropertyBody(), okLabel: "Ya, Hapus Properti" }))) {
        return;
      }
      await controller.run(async () => {
        await pages.properties.deleteProperty(api, id);
        await reloadProperties();
      }, "Properti dihapus.");
    },

    // ---------- Pose (/admin/poses) ----------
    loadPoses() {
      return controller.load("poses", () => pages.poses.loadPoses(api), []);
    },

    savePose({ id }, values) {
      return savePoseForm(id, values);
    },

    addPose(values) {
      return savePoseForm(null, values);
    },

    async deletePose({ id }) {
      if (!(await controller.confirm({ title: "Konfirmasi Hapus Pose", body: deletePoseBody(), okLabel: "Ya, Hapus Pose" }))) {
        return;
      }
      await controller.run(async () => {
        await pages.poses.deletePose(api, id);
        store.update("admin", { poses: null }, { silent: true });
      }, "Pose dihapus.");
    },

    // ---------- Akun Admin (/admin/account) ----------
    // values = { username, current_password, new_password, new_password_repeat }; setelah galat hanya username yang tetap
    async saveAccount(values) {
      const draft = { key: "account", values: { username: values.username } };
      const fail = error => {
        store.update("admin", { drafts: { ...admin().drafts, account: draft.values } }, { silent: true });
        setToast({ error }, { silent: false });
      };
      if (values.new_password !== values.new_password_repeat) {
        return fail("Pengulangan password baru tidak sama.");
      }
      if (admin().me && admin().me.must_change && !values.new_password) {
        return fail("Password baru wajib diisi.");
      }
      await controller.run(
        async () => {
          const answer = await pages.account.saveAccount(api, values);
          api.token = answer.token;
          store.update("admin", { me: { username: answer.username, must_change: false }, drafts: withoutDraft("account") }, { silent: true });
        },
        "Akun admin diperbarui.",
        undefined,
        { draft },
      );
    },
  };

  // daftar properti dimuat ulang, properti di data master (halaman studio pelanggan) juga
  async function reloadProperties() {
    store.update("admin", { properties: null }, { silent: true });
    store.update("master", await models.master.loadMaster(api), { silent: true });
  }

  // simpan satu baris properti (id null = baru); galat → isian baris itu disimpan sebagai draf
  function savePropertyForm(id, values) {
    const key = "property-" + (id || "new");
    return controller.run(
      async () => {
        await pages.properties.saveProperty(api, id, pages.properties.propertyBody(values, admin().images[key]));
        const { [key]: droppedImage, ...images } = admin().images;
        store.update("admin", { images, drafts: withoutDraft(key) }, { silent: true });
        await reloadProperties();
      },
      "Properti disimpan.",
      undefined,
      { draft: { key, values } },
    );
  }

  function savePoseForm(id, values) {
    const key = "pose-" + (id || "new");
    return controller.run(
      async () => {
        await pages.poses.savePose(api, id, pages.poses.poseBody(values));
        store.update("admin", { poses: null, drafts: withoutDraft(key) }, { silent: true });
      },
      "Pose disimpan.",
      undefined,
      { draft: { key, values } },
    );
  }

  // simpan satu baris paket: daftar dimuat ulang; galat → isian baris itu disimpan sebagai draf
  function savePackageForm(key, values, request, okMessage) {
    return controller.run(
      async () => {
        await request();
        store.update("admin", { packages: null, drafts: withoutDraft(key) }, { silent: true });
      },
      okMessage,
      undefined,
      { draft: { key, values } },
    );
  }
  return controller;
}
