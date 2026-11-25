// Adaptor DOM layar Sesi Foto: foto pose dipasang ke <img id="pose"> (src lewat mediaSrc, alt); tanpa elemen → tidak galat
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBeeper, createSessionScreen } from "../../js/components/sessionScreen.js";
import { mediaSrc } from "../../js/components/propertyVisual.js";

function fakeDocument(elements) {
  return { querySelector: selector => elements[selector] || null };
}

test("showPose: src dari mediaSrc (foto unggahan /media/ ke origin API, /img/ tetap), alt dari pengendali", () => {
  const image = { src: "", alt: "" };
  const screen = createSessionScreen({ document: fakeDocument({ "#pose": image }) });
  screen.showPose("/img/pose-placeholder.jpg", "Contoh pose untuk 1-2 orang");
  assert.deepEqual(image, { src: "/img/pose-placeholder.jpg", alt: "Contoh pose untuk 1-2 orang" });
  screen.showPose("/media/x.jpg", "Contoh pose");
  assert.deepEqual(image, { src: mediaSrc("/media/x.jpg"), alt: "Contoh pose" });
});

test("showPose: tanpa <img id=\"pose\"> (belum ada contoh pose) → tidak melakukan apa-apa", () => {
  const screen = createSessionScreen({ document: fakeDocument({}) });
  assert.doesNotThrow(() => screen.showPose("/img/a.jpg", "Contoh pose"));
});

test("showCountdown / hideCountdown: angka timer foto di atas kamera", () => {
  const box = { hidden: true, textContent: "" };
  const screen = createSessionScreen({ document: fakeDocument({ "#cd": box }) });
  screen.showCountdown(3);
  assert.deepEqual(box, { hidden: false, textContent: "3" });
  screen.hideCountdown();
  assert.deepEqual(box, { hidden: true, textContent: "" });
  assert.doesNotThrow(() => createSessionScreen({ document: fakeDocument({}) }).showCountdown(2));
});

test("capture tanpa kamera: foto simulasi diisi warna datar background pilihan", () => {
  const drawn = [];
  const context = { set fillStyle(value) { drawn.push(["fill", value]); }, fillRect: () => drawn.push(["rect"]), fillText: () => {}, set font(value) {} };
  const canvas = { getContext: () => context, toDataURL: () => "data:image/jpeg;base64,AA" };
  const screen = createSessionScreen({ document: fakeDocument({ "#cv": canvas }) });
  assert.equal(screen.capture({ fill: "#c33" }), "data:image/jpeg;base64,AA");
  assert.deepEqual(drawn.slice(0, 2), [["fill", "#c33"], ["rect"]]);
  assert.equal(canvas.width, 640);
});

test("createBeeper: beep (peringatan) dan tick (hitung mundur) memakai nada berbeda; tanpa Web Audio diam", () => {
  const tones = [];
  class Audio { constructor() { this.currentTime = 0; this.destination = {}; } createOscillator() { const osc = { frequency: {}, connect() {}, start() {}, stop: at => tones.push([osc.frequency.value, at]) }; return osc; } }
  const beeper = createBeeper(Audio);
  beeper.beep();
  beeper.tick();
  assert.deepEqual(tones, [[880, 0.4], [660, 0.12]]);
  assert.doesNotThrow(() => createBeeper(undefined).tick());
});
