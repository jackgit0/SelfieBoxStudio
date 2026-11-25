import { test } from "node:test";
import assert from "node:assert/strict";
import * as format from "../../js/core/format.js";

test("formatRupiah memakai pemisah ribuan Indonesia", () => {
  assert.equal(format.formatRupiah(150000), "Rp150.000");
  assert.equal(format.formatRupiah(0), "Rp0");
  assert.equal(format.formatRupiah(undefined), "Rp0");
});

test("formatRupiahShort menyingkat ribuan menjadi k", () => {
  assert.equal(format.formatRupiahShort(65000), "Rp 65k");
  assert.equal(format.formatRupiahShort(500), "Rp 500");
});

test("padTwo, isoDate, dateFromIso", () => {
  assert.equal(format.padTwo(7), "07");
  assert.equal(format.isoDate(new Date(2026, 0, 5)), "2026-01-05");
  const date = format.dateFromIso("2026-11-25");
  assert.deepEqual([date.getFullYear(), date.getMonth(), date.getDate()], [2026, 10, 25]);
  assert.equal(format.todayIso(), format.isoDate(new Date()));
});

test("SESSION_HOURS = 08.00 sampai 20.00 (sama dengan server)", () => {
  assert.deepEqual(format.SESSION_HOURS, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test("slotLabel, parseSlot, slotRange", () => {
  assert.equal(format.slotLabel(9), "09:00 - 09:50");
  assert.deepEqual(format.parseSlot("2026-11-25 14:00"), { date: "2026-11-25", h: 14 });
  assert.equal(format.slotRange("2026-11-25 08:00"), "08:00 - 08:50");
});

test("formatDate dan formatDayMonthYear", () => {
  assert.equal(format.formatDate("2026-11-25"), "Rabu, 25 November");
  assert.equal(format.formatDayMonthYear("2026-11-25"), "25/11/2026");
});

test("formatTime memakai WIB", () => {
  assert.equal(format.formatTime(Date.UTC(2026, 10, 25, 3, 4, 5)), "25/11/2026 - 10:04:05");
  assert.equal(format.formatTime(0), "-");
  assert.equal(format.formatTime(null), "-");
});

test("formatDateTimeWib: waktu WIB (Asia/Jakarta) dalam format Indonesia, kosong → \"-\"", async () => {
  const { formatDateTimeWib } = await import("../../js/core/format.js");
  assert.equal(formatDateTimeWib(0), "-");
  assert.equal(formatDateTimeWib(null), "-");
  const ms = Date.UTC(2026, 10, 25, 3, 4, 5);
  assert.equal(formatDateTimeWib(ms), new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }));
  assert.match(formatDateTimeWib(ms), /10\.04\.05/);
});
