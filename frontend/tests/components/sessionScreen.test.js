// Adaptor DOM layar Sesi Foto: foto pose dipasang ke <img id="pose"> (src lewat mediaSrc, alt); tanpa elemen → tidak galat
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionScreen } from "../../js/components/sessionScreen.js";
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
