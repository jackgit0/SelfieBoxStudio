// Daftar (/register): akun pelanggan baru (AuthController.register). View murni (dulu V.auth mode register).
import { html } from "../../core/html.js";
import { authCard, authTabs, typedValue } from "./layout.js";

export function registerView(state) {
  const value = name => typedValue(state, "register", name);
  return authCard(
    state,
    "register",
    html`${authTabs("register")}
      <form novalidate data-submit="auth:register">
        <label for="n">Nama</label><input id="n" name="name" autocomplete="name" value="${value("name")}" /><label
          for="p"
          >Telepon</label
        ><input id="p" name="phone" inputmode="numeric" autocomplete="tel" value="${value("phone")}" /><label for="e"
          >Email</label
        ><input id="e" name="email" type="email" autocomplete="email" value="${value("email")}" /><label for="pw"
          >Password (min. 6 karakter)</label
        ><input id="pw" name="password" type="password" autocomplete="new-password" />
        <div style="margin-top:18px"><button class="btn block" type="submit">Daftar</button></div>
      </form>`,
  );
}
