// Lupa Sandi (/forgot-password): kirim tautan buat sandi baru ke email (AuthController.forgot). View murni (dulu V.auth mode forgot).
import { html } from "../../core/html.js";
import { authCard, typedValue } from "./layout.js";

export function forgotView(state) {
  return authCard(state, "forgot", html`<h2 class="h2">Lupa Sandi</h2><p class="m sm">Masukkan email akun Anda. Tautan untuk membuat sandi baru akan dikirim ke email tersebut.</p><form novalidate data-submit="auth:forgot"><label for="e">Email</label><input id="e" name="email" type="email" value="${typedValue(state, "forgot", "email")}"><div class="row" style="margin-top:18px"><button class="btn grow" type="submit">Kirim Tautan</button><button class="btn ghost" type="button" data-route="/login">Kembali</button></div></form>`);
}
