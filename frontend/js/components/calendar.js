// Kalender bulanan untuk memilih tanggal (dulu calHTML() di customer.js). Murni: hari ini dan bulan yang ditampilkan diberikan pemanggil.
// context = "home" (Filter Jadwal di Browse) atau "book" (langkah Pilih Waktu); selected dan today = "YYYY-MM-DD"; month = { year, month (0–11) }.
// Klik tanggal → data-action="calendar:pick" (data-context, data-date); panah bulan → "calendar:month" (data-context, data-step = -1 / 1).
import { html } from "../core/html.js";
import { isoDate } from "../core/format.js";
import { icon } from "./icon.js";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function calendar({ context, selected, month, today }) {
  const firstWeekday = (new Date(month.year, month.month, 1).getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const blanks = Array.from({ length: firstWeekday }, () => html`<i></i>`);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = isoDate(new Date(month.year, month.month, index + 1));
    return html`<button
      class="cd ${date === selected ? "on" : ""}"
      ${date < today ? "disabled" : ""}
      data-action="calendar:pick"
      data-context="${context}"
      data-date="${date}"
    >
      ${index + 1}
    </button>`;
  });
  const title = new Date(month.year, month.month, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return html`<div class="cal">
    <div class="calh">
      <button
        class="ib"
        aria-label="Bulan sebelumnya"
        data-action="calendar:month"
        data-context="${context}"
        data-step="-1"
      >
        ${icon("left", 16)}</button
      ><b>${title}</b
      ><button
        class="ib"
        aria-label="Bulan berikutnya"
        data-action="calendar:month"
        data-context="${context}"
        data-step="1"
      >
        ${icon("right", 16)}
      </button>
    </div>
    <div class="calg">${WEEKDAYS.map(day => html`<small>${day}</small>`)}${blanks}${days}</div>
  </div>`;
}

// bulan tujuan panah kalender: shown = bulan yang tampil, step = -1 / 1, current = bulan sekarang (batas mundur);
// null bila tujuannya sebelum bulan sekarang
export function shiftMonth(shown, step, current) {
  const target = shown.year * 12 + shown.month + Number(step);
  if (target < current.year * 12 + current.month) {
    return null;
  }
  return { year: Math.floor(target / 12), month: target % 12 };
}

// bulan sebuah tanggal "YYYY-MM-DD" → { year, month (0–11) }
export function monthOf(isoDate) {
  return { year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) - 1 };
}
