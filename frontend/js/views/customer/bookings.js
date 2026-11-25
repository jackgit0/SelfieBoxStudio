// Booking Saya (/bookings, Riwayat = /bookings?tab=history): booking milik user per hari. View murni (dulu V.my dan stTag di customer.js).
// Booking belum dibayar yang lewat batas bayar tampil Dibatalkan tanpa mengubah data (models/booking.js withLocalExpiry, decisions.md 56).
import { html } from "../../core/html.js";
import { formatDate, slotRange } from "../../core/format.js";
import { packageOf, studioOf } from "../../models/master.js";
import { groupByDay, myBookings, statusTone } from "../../models/booking.js";

// label status booking (juga dipakai Detail Booking)
export function statusTag(booking) {
  return html`<span class="tag ${statusTone(booking.status)}">${booking.status}</span>`;
}

// match.query.tab = "history" → Riwayat
export function bookingsView(state, match, now = new Date()) {
  const { data, master, persisted } = state;
  const tab = match.query.tab === "history" ? "hist" : "up";
  const groups = groupByDay(myBookings(data.bookings, { userId: persisted.me, tab, now }), tab);
  const rows = groups.map(group => html`<div class="dayh">${formatDate(group.date)}</div>${group.bookings.map(booking => html`<button class="brow" data-route="/bookings/${booking.id}"><div><b>${studioOf(master, booking.studio).name}</b><div class="sub">${packageOf(master, booking.package_id).name} · ${statusTag(booking)}</div></div><b>${slotRange(booking.date)}</b></button>`)}`);
  const empty = html`<div class="card center m" style="margin-top:12px">${tab === "up" ? "Belum ada booking mendatang." : "Belum ada riwayat booking."}<div style="margin-top:12px"><button class="btn" data-route="/browse">Cari studio</button></div></div>`;
  return html`<div class="panel"><h1 class="h1">Booking Saya</h1><div class="seg"><button class="${tab === "up" ? "on" : ""}" data-route="/bookings">Mendatang</button><button class="${tab === "hist" ? "on" : ""}" data-route="/bookings?tab=history">Riwayat</button></div>
${groups.length ? rows : empty}</div>`;
}
