// Daftar Booking admin (/admin/bookings, Figma "Admin - Booking"): saringan status, tabel, panel Detail Booking dengan form Ubah Booking
// (US-15, Figma "Admin - Edit Booking"). View murni (dulu V.abook, bookPanel, bookEdit di admin.js). Form dikirim lewat data-submit
// (AdminBookingController.save); pilihan yang batal/gagal disimpan dibaca dari admin.drafts["booking-<id>"].
import { html } from "../../core/html.js";
import { formatRupiah, formatTime } from "../../core/format.js";
import { PAYMENT_LABELS } from "../../models/booking.js";
import {
  STATUSES,
  canChangePackage,
  isEditable,
  packageOptions,
  slotHours,
  statusOptions,
  statusTone,
} from "../../models/admin/bookings.js";
import { matchesQuery } from "../../models/admin/search.js";
import { keyValueRows } from "../../components/keyValueRows.js";
import { icon } from "../../components/icon.js";
import { loadingCard } from "../../components/adminWidgets.js";

const statusTag = status => html`<span class="tag ${statusTone(status)}">${status}</span>`;
// booking terbayar yang sudah check-in di meja depan (sesi dimulai dari tablet studio)
const checkedInTag = booking =>
  booking.status == "Terbayar" && booking.checked_in_at ? html`<br /><span class="tag ok">Sudah check-in</span>` : "";

// Check-in (hari sesi, sampai slot berakhir): tombol aktif bila server tidak memberi alasan penolakan (checkin_block)
function checkInBox(detail) {
  if (detail.status != "Terbayar") {
    return "";
  }
  if (detail.checked_in_at) {
    return html`<div class="cibox ok">
      ${icon("check", 18)}
      <span>Sudah check-in ${formatTime(detail.checked_in_at)}. Sesi dimulai dari tablet ${detail.studio_name}.</span>
    </div>`;
  }
  return html`<div class="cibox">
    <button class="btn sm" data-action="adminBooking:checkIn" data-id="${detail.id}" ${detail.checkin_block ? "disabled" : ""}>
      ${icon("check", 16)} Check-in
    </button>
    <span class="sm m">${detail.checkin_block ? detail.checkin_block + "." : "Pelanggan sudah datang di studio."}</span>
  </div>`;
}

function bookingRows(rows, openId) {
  if (!rows.length) {
    return html`<tr>
      <td colspan="9" class="m">Tidak ada booking.</td>
    </tr>`;
  }
  return rows.map(booking => {
    const open = openId == booking.id;
    return html`<tr class="${open ? "on" : ""}">
      <td>${booking.id}</td>
      <td>${booking.customer}<br /><small class="m">${booking.email}</small></td>
      <td>${booking.studio}</td>
      <td class="bx">${booking.package}</td>
      <td>${booking.slot}</td>
      <td class="bx">${formatRupiah(booking.amount)}</td>
      <td>
        ${statusTag(booking.status)}${checkedInTag(booking)}${booking.cancel_reason
          ? html`<br /><small class="m">${booking.cancel_reason}</small>`
          : ""}
      </td>
      <td class="bx">
        ${PAYMENT_LABELS[booking.pay_status] || "-"}${booking.method ? html`<br /><small class="m">${booking.method}</small>` : ""}
      </td>
      <td>
        <button
          class="btn sm ${open ? "" : "ghost"}"
          data-action="adminBooking:open"
          data-id="${booking.id}"
          aria-label="Detail booking #${booking.id}"
        >
          Detail
        </button>
      </td>
    </tr>`;
  });
}

function editForm(detail, draft) {
  if (!isEditable(detail)) {
    return "";
  }
  const options = statusOptions(detail);
  const chosen = draft && options.includes(draft.status) ? draft.status : detail.status;
  const chosenPackage = (draft && draft.package_id) || detail.package_id;
  const changeable = canChangePackage(detail);
  const radios = options.map(
    status =>
      html`<label
        ><input type="radio" name="status" value="${status}" ${status == chosen ? "checked" : ""} />
        ${status}${status == detail.status ? " (sekarang)" : ""}</label
      >`,
  );
  const packages = packageOptions(detail).map(
    pkg =>
      html`<option value="${pkg.id}" ${pkg.id == chosenPackage ? "selected" : ""}>
        ${pkg.name}${pkg.price == null ? "" : " · " + formatRupiah(pkg.price)}
      </option>`,
  );
  const refundNote =
    detail.allowed.includes("Dibatalkan") && detail.payment.status == "paid"
      ? html`<p class="sm m" style="margin-top:6px">
          Mengubah status booking yang sudah dibayar menjadi Dibatalkan akan mengembalikan dana 100% kepada pelanggan.
        </p>`
      : "";
  return html`<form novalidate data-submit="adminBooking:save" data-id="${detail.id}">
    <h4 class="bh">Ubah Booking</h4>
    <fieldset class="brad">
      <legend class="sm m">Status Booking</legend>
      ${radios}
    </fieldset>
    ${refundNote}
    <label class="sm m" for="be-pkg" style="display:block;margin-top:12px">Paket</label
    ><select id="be-pkg" name="package_id" ${changeable ? "" : "disabled"}>
      ${packages}
    </select>
    <p class="sm m" style="margin-top:6px">
      Paket hanya dapat diubah sebelum booking
      dibayar${changeable ? "; total dihitung ulang (paket + biaya studio − diskon)" : ""}.
    </p>
    <button class="btn sm" type="submit" style="margin-top:10px;width:100%">Simpan Perubahan</button>
  </form>`;
}

function detailPanel(detail, draft) {
  const payment = detail.payment;
  const studioSession = detail.studio_session;
  const sessionNote = studioSession
    ? html`<br /><small class="m"
          >Sesi studio ${studioSession.date} ${studioSession.start} -
          ${studioSession.end}${studioSession.deleted ? " (dihapus)" : ""}</small
        >`
    : "";
  const cancelNote = detail.cancel_reason
    ? html`<br /><small class="m"
          >${detail.cancel_reason}${detail.cancel_detail ? ": " + detail.cancel_detail : ""}</small
        >`
    : "";
  const bookingInfo = keyValueRows([
    ["Tanggal", detail.slot.split(" ")[0]],
    [
      "Pelanggan",
      html`${detail.customer.name}<br /><small class="m">${detail.customer.email} · ${detail.customer.phone}</small>`,
    ],
    ["Studio", detail.studio_name],
    ["Sesi", html`${slotHours(detail.slot)}${sessionNote}`],
    ["Paket", detail.package_name],
    ["Status", html`${statusTag(detail.status)}${cancelNote}`],
    ["Dipesan", formatTime(detail.created_at)],
  ]);
  const paymentInfo = keyValueRows([
    ["Invoice", detail.invoice],
    ["Waktu", formatTime(payment.paid_at)],
    ["Status", PAYMENT_LABELS[payment.status] || payment.status],
    ["Metode", payment.method || "-"],
    ...(payment.refunded_at ? [["Refund", formatTime(payment.refunded_at)]] : []),
    ...(payment.status == "pending" ? [["Batas bayar", formatTime(payment.expire_at)]] : []),
    ["Paket", formatRupiah(detail.items_price)],
    ["Biaya Studio", formatRupiah(detail.studio_fee)],
    ...(detail.main_disc ? [["Diskon utama", "-" + formatRupiah(detail.main_disc), "disc"]] : []),
    ["Total", formatRupiah(detail.amount), "total"],
  ]);
  const deleteButton = detail.delete_block
    ? ""
    : html`<button
        class="ibtn del"
        data-action="adminBooking:delete"
        data-id="${detail.id}"
        title="Hapus booking"
        aria-label="Hapus booking #${detail.id}"
      >
        ${icon("trash", 18)}
      </button>`;
  return html`<aside class="card bdet" aria-label="Detail booking #${detail.id}">
    <div class="row sp">
      <h3 class="h3">Detail Booking #${detail.id}</h3>
      <div class="row" style="gap:6px">
        ${deleteButton}<button class="ib" data-action="adminBooking:close" title="Tutup" aria-label="Tutup detail">
          ✕
        </button>
      </div>
    </div>
    ${checkInBox(detail)} ${bookingInfo} ${editForm(detail, draft)}
    <h4 class="bh">Detail Pembayaran</h4>
    ${paymentInfo}
    ${detail.delete_block ? html`<p class="sm m" style="margin-top:10px">${detail.delete_block}.</p>` : ""}
  </aside>`;
}

export function bookingsView(state) {
  const { bookings, bookingDetail: detail, bookingFilter, query, drafts } = state.admin;
  if (!bookings) {
    return loadingCard();
  }
  const rows = bookings.filter(booking =>
    matchesQuery(query, booking.customer, booking.email, booking.studio, booking.package, booking.slot),
  );
  const filter = html`<select style="width:auto" aria-label="Saring status" data-change="adminBooking:setFilter">
    <option value="">Semua status</option>
    ${STATUSES.map(status => html`<option ${bookingFilter == status ? "selected" : ""}>${status}</option>`)}
  </select>`;
  return html`<div class="bgrid ${detail ? "open" : ""}">
    <div class="card">
      <div class="row sp">${filter}<span class="m sm">${rows.length} booking</span></div>
      <div class="tbl" style="margin-top:8px">
        <table>
          <tr>
            <th>#</th>
            <th>Pelanggan</th>
            <th>Studio</th>
            <th class="bx">Paket</th>
            <th>Jadwal</th>
            <th class="bx">Total</th>
            <th>Status</th>
            <th class="bx">Bayar</th>
            <th></th>
          </tr>
          ${bookingRows(rows, detail && detail.id)}
        </table>
      </div>
    </div>
    ${detail ? detailPanel(detail, drafts["booking-" + detail.id]) : ""}
  </div>`;
}
