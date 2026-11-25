// Prettier merapikan HTML di dalam html`…` (npm run format), jadi keluaran view memuat baris baru + indentasi yang diabaikan browser.
// flat() membuang spasi yang memuat baris baru sebelum markup dicocokkan: di samping tag dibuang (termasuk sebelum ">" penutup tag,
// mis. "</b\n>" yang dipakai Prettier agar tidak menambah spasi yang tampil), di antara teks atau atribut menjadi satu spasi.
// Spasi tanpa baris baru (mis. "</svg> Kembali") tidak disentuh, jadi spasi yang memang tampil di halaman tetap teruji.
// Prettier juga menulis elemen void HTML sebagai <input … />, <br />; browser memperlakukannya sama dengan <input …>, jadi "/" dibuang
// (hanya untuk elemen void HTML; <path …/> di SVG tetap).
const VOID = /<(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)\b([^>]*?)\s*\/>/g;

export function flat(value) {
  return String(value)
    .replace(/\s*\n\s*(\/?>)/g, "$1")
    .replace(/>\s*\n\s*/g, ">")
    .replace(/\s*\n\s*</g, "<")
    .replace(/\s*\n\s*/g, " ")
    .replace(VOID, "<$1$2>");
}
