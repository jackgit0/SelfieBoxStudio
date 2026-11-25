// Modal "Masuk Mode Staf" (dulu dialog bawaan browser, decisions.md 4, 27, 41): fokus awal di isian PIN, Enter = Masuk,
// setelah ditutup fokus ke tombol avatar (item menu yang membukanya sudah tersembunyi). Resolve { value: "ok" | null, data: PIN }.
import { html } from "../../core/html.js";

export function staffPinModal() {
  return {
    title: "Masuk Mode Staf",
    body: html`<p>Masukkan PIN staf untuk mengaktifkan Mode Staf.</p>
      <label for="staff-pin">PIN staf</label
      ><input id="staff-pin" type="password" inputmode="numeric" autocomplete="off" />`,
    buttons: [
      { label: "Batal", value: null, style: "ghost" },
      { label: "Masuk", value: "ok" },
    ],
    initialFocus: "#staff-pin",
    returnFocus: ".avatar",
    enterValue: "ok",
    read: box => box.querySelector("#staff-pin").value.trim(),
  };
}
