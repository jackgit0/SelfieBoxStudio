// Panel "Detail Sesi" di accordion studio admin (Figma): kalender bulan (titik = ada sesi) + chip jam per hari, form ubah dan tambah sesi.
// View murni (dulu sessCal, sChip, sessEdit, sessAdd, sessPanel di admin.js). Form dikirim lewat data-submit (StudioController.saveSession / addSession);
// isian yang gagal disimpan dibaca dari admin.drafts ("session-<id>", "session-new-<studio>").
import { html } from "../../core/html.js";
import { formatDate, padTwo } from "../../core/format.js";
import { sessionsKey, shownDay, shownMonth } from "../../models/admin/sessions.js";
import { icon } from "../../components/icon.js";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function monthCalendar(studioId, month, selectedDay, list, today) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const blanks = Array.from({ length: firstWeekday }, () => html`<i></i>`);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = `${year}-${padTwo(monthNumber)}-${padTwo(index + 1)}`;
    const count = list.filter(session => session.date == date).length;
    return html`<button class="cd ${date == selectedDay ? "on" : ""} ${count ? "dot" : ""} ${date == today ? "now" : ""}" data-action="studio:pickSessionDay" data-studio="${studioId}" data-date="${date}" aria-label="${date}${count ? `, ${count} sesi` : ""}" aria-pressed="${String(date == selectedDay)}">${index + 1}</button>`;
  });
  const title = new Date(year, monthNumber - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return html`<div class="cal"><div class="calh"><button class="ib" aria-label="Bulan sebelumnya" data-action="studio:moveSessionMonth" data-studio="${studioId}" data-step="-1">${icon("left", 16)}</button><b>${title}</b><button class="ib" aria-label="Bulan berikutnya" data-action="studio:moveSessionMonth" data-studio="${studioId}" data-step="1">${icon("right", 16)}</button></div>
<div class="calg">${WEEKDAYS.map(day => html`<small>${day}</small>`)}${blanks}${days}</div></div>`;
}

function chipStatus(session) {
  if (session.past) {
    return "lewat";
  }
  if (session.booking && session.booking.status == "Sesi Berjalan") {
    return "Berlangsung";
  }
  return session.status == "UNAVAILABLE" ? "Terisi" : "Tersedia";
}

function sessionChip(studioId, session, editingId) {
  const open = editingId == session.id;
  const who = session.booking ? html` · #${session.booking.id} ${session.booking.customer}` : "";
  return html`<button class="schip ${session.status == "UNAVAILABLE" ? "full" : ""} ${session.past ? "past" : ""} ${open ? "on" : ""}" data-action="studio:toggleSession" data-studio="${studioId}" data-id="${session.id}" aria-expanded="${String(open)}">${session.start} - ${session.end}<small>${chipStatus(session)}${who}</small></button>`;
}

function timeFields(idPrefix, values) {
  return html`<div><label for="${idPrefix}d">Tanggal</label><input id="${idPrefix}d" name="date" type="date" value="${values.date}"></div><div><label for="${idPrefix}s">Mulai</label><input id="${idPrefix}s" name="start" type="time" value="${values.start}"></div><div><label for="${idPrefix}e">Selesai</label><input id="${idPrefix}e" name="end" type="time" value="${values.end}"></div>`;
}

function editForm(studioId, session, draft) {
  const booking = session.booking;
  const running = booking && booking.status == "Sesi Berjalan";
  const header = html`<div class="row sp"><b>Sesi ${session.date} · ${session.start} - ${session.end}</b><button class="ibtn del" type="button" data-action="studio:deleteSession" data-studio="${studioId}" data-id="${session.id}" title="Hapus sesi" aria-label="Hapus sesi ${session.start}">${icon("trash", 18)}</button></div>
<p class="sm m">${booking ? `Booking #${booking.id} · ${booking.customer} · ${booking.status}` : "Belum ada booking pada sesi ini."}</p>`;
  if (session.past || running) {
    return html`<div class="sform">${header}
<p class="sm m">${session.past ? "Sesi sudah lewat" : "Sesi foto sedang berlangsung"} sehingga tidak dapat diubah.</p></div>`;
  }
  return html`<form class="sform" novalidate data-submit="studio:saveSession" data-studio="${studioId}" data-id="${session.id}">${header}
<div class="srow">${timeFields(`se${session.id}`, draft || session)}</div>
<div class="row" style="margin-top:12px"><button class="btn sm" type="submit">Simpan</button><button class="btn sm ghost" type="button" data-action="studio:closeSessionForm">Tutup</button></div></form>`;
}

function addForm(studioId, day, today, draft) {
  const idPrefix = `sa${studioId}`;
  const values = draft || { date: day < today ? today : day, start: "09:00", end: "09:50", repeat: "1" };
  return html`<form class="sform" novalidate data-submit="studio:addSession" data-studio="${studioId}"><b>Tambah sesi</b><div class="srow"><div><label for="${idPrefix}d">Tanggal</label><input id="${idPrefix}d" name="date" type="date" min="${today}" value="${values.date}"></div><div><label for="${idPrefix}s">Mulai</label><input id="${idPrefix}s" name="start" type="time" value="${values.start}"></div><div><label for="${idPrefix}e">Selesai</label><input id="${idPrefix}e" name="end" type="time" value="${values.end}"></div><div><label for="${idPrefix}r">Berulang (hari)</label><input id="${idPrefix}r" name="repeat" type="number" min="1" max="30" value="${values.repeat}"></div></div>
<p class="sm m" style="margin-top:6px">Berulang 1 = hanya tanggal ini; lebih dari 1 = jam yang sama pada hari-hari berikutnya (tanggal yang bertabrakan dilewati).</p><div class="row" style="margin-top:12px"><button class="btn sm" type="submit">Tambah</button><button class="btn sm ghost" type="button" data-action="studio:closeSessionForm">Batal</button></div></form>`;
}

// admin = slice admin; studio = baris daftar studio; today = "YYYY-MM-DD"
export function sessionPanel(admin, studio, today) {
  const list = admin.sessions[sessionsKey(admin, studio.id, today)];
  if (!list) {
    return html`<div class="spanel"><h4>Detail Sesi</h4><p class="m">Memuat…</p></div>`;
  }
  const day = shownDay(admin, studio.id, today);
  const ofDay = list.filter(session => session.date == day);
  const editing = ofDay.find(session => session.id == admin.editingSession);
  const adding = admin.addingSessionFor == studio.id;
  return html`<div class="spanel"><h4>Detail Sesi</h4><div class="ssgrid"><div>${monthCalendar(studio.id, shownMonth(admin, studio.id, today), day, list, today)}</div><div><p class="sm m" style="margin-bottom:10px">${formatDate(day)} · ${ofDay.length} sesi</p>
<div class="schips">${ofDay.map(session => sessionChip(studio.id, session, admin.editingSession))}<button class="schip add" data-action="studio:toggleAddSession" data-studio="${studio.id}" aria-expanded="${String(adding)}">${icon("plus", 16)} TAMBAH</button></div>
${ofDay.length ? "" : html`<p class="sm m" style="margin-top:10px">Belum ada sesi pada tanggal ini.</p>`}${editing ? editForm(studio.id, editing, admin.drafts["session-" + editing.id]) : ""}${adding ? addForm(studio.id, day, today, admin.drafts["session-new-" + studio.id]) : ""}</div></div></div>`;
}
