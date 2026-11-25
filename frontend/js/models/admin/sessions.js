// Sesi studio di panel admin (panel "Detail Sesi", dulu sMonth, sessLoad, sNav, sAdd, sSave, sDel di admin.js).
// Bulan "YYYY-MM" dan hari "YYYY-MM-DD" yang tampil disimpan per studio di slice admin (sessionMonths, sessionDays); bawaan = hari ini.
// Sesi dimuat per bulan dan disimpan di admin.sessions["<studio>|<bulan>"].
import { padTwo } from "../../core/format.js";
import { confirmPath } from "./confirmable.js";

export function shownMonth(admin, studioId, today) {
  return admin.sessionMonths[studioId] || today.slice(0, 7);
}

export function shownDay(admin, studioId, today) {
  return admin.sessionDays[studioId] || today;
}

export function sessionsKey(admin, studioId, today) {
  return studioId + "|" + shownMonth(admin, studioId, today);
}

// "2026-12" + 1 → "2027-01" (tanpa batas mundur: admin boleh melihat sesi bulan lalu)
export function shiftMonth(month, step) {
  const [year, monthNumber] = month.split("-").map(Number);
  const target = year * 12 + (monthNumber - 1) + Number(step);
  return `${Math.floor(target / 12)}-${padTwo((target % 12) + 1)}`;
}

// hari terpilih setelah pindah bulan: hari ini bila bulannya bulan sekarang, selain itu tanggal 1
export function dayForMonth(month, today) {
  return today.startsWith(month) ? today : month + "-01";
}

// isian form Tambah sesi → body server; berulang kosong = 1 hari
export function addBody(values) {
  return {
    date: values.date,
    start: values.start,
    end: values.end,
    repeat: values.repeat === "" || values.repeat === undefined ? 1 : Number(values.repeat),
  };
}

export function changeBody(values) {
  return { date: values.date, start: values.start, end: values.end };
}

export function loadSessions(api, studioId, month) {
  return api.get(`/admin/studios/${studioId}/sessions?month=${month}`);
}

// jawaban { created: [...], skipped: ["YYYY-MM-DD", ...] }
export function addSessions(api, studioId, body) {
  return api.post(`/admin/studios/${studioId}/sessions`, body);
}

export function updateSession(api, id, body, confirmed = false) {
  const path = "/admin/sessions/" + id;
  return api.patch(confirmed ? confirmPath(path) : path, body);
}

export function deleteSession(api, id, confirmed = false) {
  const path = "/admin/sessions/" + id;
  return api.del(confirmed ? confirmPath(path) : path);
}
