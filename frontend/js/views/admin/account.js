// Akun Admin (/admin/account): ganti username dan password admin. View murni (dulu V.aacct di admin.js).
// Form dikirim lewat data-submit (AdminController.saveAccount); setelah galat hanya username yang tetap (admin.drafts.account), password dikosongkan.
import { html } from "../../core/html.js";

export function accountView(state) {
  const me = state.admin.me || { username: "", must_change: false };
  const draft = state.admin.drafts.account;
  const username = draft ? draft.username : me.username;
  return html`<form class="card" style="max-width:560px" novalidate data-submit="admin:saveAccount">
    <h3 class="h3">Akun Admin</h3>
    <p class="m sm" style="margin-top:4px">
      Akun admin tersimpan di database dengan password ter-hash. Password baru minimal 8 karakter dan mengandung huruf
      serta angka. Setelah password diganti, semua sesi admin lama otomatis keluar.
    </p>
    <label for="ac_u">Username</label
    ><input id="ac_u" name="username" value="${username}" autocomplete="username" /><label for="ac_c"
      >Password saat ini</label
    ><input id="ac_c" type="password" name="current_password" autocomplete="current-password" />
    <label for="ac_n">Password baru ${me.must_change ? "(wajib)" : "(kosongkan jika tidak diganti)"}</label
    ><input id="ac_n" type="password" name="new_password" autocomplete="new-password" /><label for="ac_n2"
      >Ulangi password baru</label
    ><input id="ac_n2" type="password" name="new_password_repeat" autocomplete="new-password" />
    <div class="row" style="margin-top:18px"><button class="btn" type="submit">Simpan</button></div>
  </form>`;
}
