// Masuk (/login): satu form untuk email pelanggan dan username admin (AuthController.login). View murni (dulu V.auth mode login).
import { html } from "../../core/html.js";
import { authCard, authTabs, typedValue } from "./layout.js";

export function loginView(state) {
  return authCard(state, "login", html`${authTabs("login")}<form novalidate data-submit="auth:login"><label for="e">Email atau username</label><input id="e" name="identifier" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${typedValue(state, "login", "identifier")}"><label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password"><div class="row sp" style="margin-top:18px"><button class="btn grow" type="submit">Masuk</button></div><p class="center sm" style="margin-top:14px"><a href="/forgot-password" data-route="/forgot-password">Lupa sandi?</a></p></form>`);
}
