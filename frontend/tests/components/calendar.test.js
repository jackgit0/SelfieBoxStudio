import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { calendar, shiftMonth } from "../../js/components/calendar.js";
import { flat } from "../helpers/markup.js";

// November 2026: tanggal 1 jatuh pada hari Minggu → enam sel kosong bila Senin hari pertama
const november = { context: "book", selected: "2026-11-27", month: { year: 2026, month: 10 }, today: "2026-11-25" };

test("hari pertama minggu = Senin: sel kosong sebelum tanggal 1", () => {
  const markup = calendar(november);
  assert.ok(markup instanceof Safe);
  const grid = flat(markup).split('<div class="calg">')[1];
  assert.match(grid, /^<small>Sen<\/small><small>Sel<\/small><small>Rab<\/small><small>Kam<\/small><small>Jum<\/small><small>Sab<\/small><small>Min<\/small>(<i><\/i>){6}<button/);
  const march = flat(calendar({ ...november, month: { year: 2027, month: 2 } })).split('<div class="calg">')[1];
  assert.match(march, /<\/small><button/); // 1 Maret 2027 hari Senin: tanpa sel kosong
});

test("jumlah hari dalam bulan, judul bulan", () => {
  const text = flat(calendar(november));
  assert.equal((text.match(/class="cd/g) || []).length, 30);
  assert.equal((flat(calendar({ ...november, month: { year: 2028, month: 1 } })).match(/class="cd/g) || []).length, 29);
  assert.match(text, /<b>November 2026<\/b>/);
});

test("hari yang sudah lewat dinonaktifkan, hari ini dan sesudahnya tidak", () => {
  const text = flat(calendar(november));
  assert.match(text, /<button class="cd " disabled data-action="calendar:pick" data-context="book" data-date="2026-11-24">24<\/button>/);
  assert.match(text, /<button class="cd " data-action="calendar:pick" data-context="book" data-date="2026-11-25">25<\/button>/);
  assert.equal((text.match(/ disabled /g) || []).length, 24);
});

test("tanggal terpilih ditandai", () => {
  const text = flat(calendar(november));
  assert.match(text, /<button class="cd on" data-action="calendar:pick" data-context="book" data-date="2026-11-27">27<\/button>/);
  assert.equal((text.match(/class="cd on"/g) || []).length, 1);
});

test("navigasi bulan memakai data-action dengan konteks dan arah", () => {
  const text = flat(calendar({ ...november, context: "home" }));
  assert.match(text, /<button class="ib" aria-label="Bulan sebelumnya" data-action="calendar:month" data-context="home" data-step="-1">/);
  assert.match(text, /<button class="ib" aria-label="Bulan berikutnya" data-action="calendar:month" data-context="home" data-step="1">/);
  assert.doesNotMatch(text, /onclick=/);
});

test("shiftMonth: maju/mundur antartahun, null bila sebelum bulan sekarang", () => {
  const current = { year: 2026, month: 10 };
  assert.deepEqual(shiftMonth(current, 1, current), { year: 2026, month: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1, current), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth({ year: 2027, month: 0 }, -1, current), { year: 2026, month: 11 });
  assert.equal(shiftMonth(current, -1, current), null);
});
