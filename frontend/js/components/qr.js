// QR dekoratif di langkah Paket & Pembayaran (pembayaran simulasi, bukan QRIS sungguhan; dulu qr() di customer.js).
// seed = id studio, jadi polanya tetap untuk studio yang sama. Tiga kotak penanda di sudut seperti QR asli.
import { raw } from "../core/html.js";

const SIZE = 21;

function isFinderArea(x, y) {
  return (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
}

function finderCell(x, y) {
  return (
    x % 6 == 0 ||
    y % 6 == 0 ||
    x == 14 ||
    x == 20 ||
    y == 14 ||
    y == 20 ||
    (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5)
  );
}

export function qr(seed) {
  let hash = 7;
  let cells = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      hash = (hash * 31 + x * 17 + y * 13 + (seed || 1)) % 97;
      const filled = isFinderArea(x, y) ? finderCell(x, y) : hash % 2;
      if (filled) {
        cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  // markup buatan kode sendiri (angka saja), aman dipasang apa adanya
  return raw(
    `<svg viewBox="0 0 21 21" width="160" fill="#1c2748" style="background:#fff;padding:8px;border-radius:12px;border:1px solid var(--line-2)">${cells}</svg>`,
  );
}
