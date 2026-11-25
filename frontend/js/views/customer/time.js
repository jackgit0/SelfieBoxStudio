// Pilih Tanggal & Waktu (/book/time) dan Ubah Jadwal (/bookings/:id/reschedule): kalender, sesi 50 menit, tombol lanjut.
// View murni (dulu V.time di customer.js). Tombol "Lanjut ke Pembayaran" / "Simpan Jadwal Baru" tidak pernah dinonaktifkan:
// tanpa sesi, BookingController.next membuka popup Input Tidak Valid.
import { html } from "../../core/html.js";
import { SESSION_HOURS, formatDate, isoDate, slotLabel } from "../../core/format.js";
import { isStudioShown, studioOf } from "../../models/master.js";
import { freeHours } from "../../models/studio.js";
import { calendar, monthOf } from "../../components/calendar.js";
import { icon } from "../../components/icon.js";
import { studioUnavailable } from "./studio.js";

// bulan yang ditampilkan kalender langkah ini: runtime.calendar.book setelah panah bulan dipakai, selain itu bulan tanggal booking
// (tanggal Desember dari Filter Jadwal langsung terlihat; decisions.md 52)
function shownMonth(runtime, date) {
  return runtime.calendar.book || monthOf(date);
}

function slotButton(booking, date, hour, free) {
  const slot = `${date} ${hour}:00`;
  return html`<button class="${booking.slot === slot ? "pill on" : "pill"}" ${free.includes(hour) ? "" : "disabled"} data-action="booking:pickSlot" data-slot="${slot}">${slotLabel(hour)}</button>`;
}

export function timeView(state, match, now = new Date()) {
  const { booking, master, runtime } = state;
  if (!booking.studio) {
    return html`<div class="card">Pilih studio terlebih dahulu.</div>`;
  }
  const rescheduleId = booking.rescheduleId;
  if (!isStudioShown(master, booking.studio)) {
    return studioUnavailable({ rescheduleId });
  }
  const studio = studioOf(master, booking.studio);
  const today = isoDate(now);
  const date = booking.date || today;
  const free = freeHours(runtime.availability, studio.id, date, now);
  const back = rescheduleId ? `/bookings/${rescheduleId}` : `/studios/${studio.id}`;
  return html`<div class="panel"><button class="back" data-route="${back}">${icon("left", 16)} ${rescheduleId ? "Batal ubah jadwal" : "Kembali"}</button>
<div class="row sp"><div><h1 class="h1">${rescheduleId ? "Ubah Jadwal" : "Pilih Tanggal & Waktu"}</h1><p class="sub">${studio.name} · ${studio.address || ""}</p></div>${rescheduleId ? "" : html`<span class="steps">1/2</span>`}</div>
<div class="card" style="margin-top:16px"><div class="bk"><div><h3 class="h3" style="margin-bottom:10px">Pilih Tanggal</h3>${calendar({ context: "book", selected: date, month: shownMonth(runtime, date), today })}</div>
<div><h3 class="h3">Pilih Sesi</h3><p class="sub">${formatDate(date)} · tiap sesi 50 menit</p><div class="slots">${SESSION_HOURS.map(hour => slotButton(booking, date, hour, free))}</div></div></div>
<button class="btn block" style="margin-top:22px" data-action="booking:next">${rescheduleId ? "Simpan Jadwal Baru" : "Lanjut ke Pembayaran"}</button></div></div>`;
}
