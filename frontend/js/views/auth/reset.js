// Buat Sandi Baru (/reset-password, dari tautan email /#reset=<token>): AuthController.reset. View murni (dulu V.auth mode reset).
import { html } from "../../core/html.js";
import { authCard } from "./layout.js";

export function resetView(state) {
  return authCard(
    state,
    "reset",
    html`<h2 class="h2">Buat Sandi Baru</h2>
      <form novalidate data-submit="auth:reset">
        <label for="pw">Password baru</label
        ><input id="pw" name="password" type="password" autocomplete="new-password" /><label for="pw2"
          >Ulangi password</label
        ><input id="pw2" name="confirmation" type="password" autocomplete="new-password" />
        <div style="margin-top:18px"><button class="btn block" type="submit">Simpan Sandi</button></div>
      </form>`,
  );
}
