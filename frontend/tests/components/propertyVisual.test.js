import { test } from "node:test";
import assert from "node:assert/strict";
import { backgroundImage, mediaSrc, propertyVisual } from "../../js/components/propertyVisual.js";

const RENDER = "https://selfieboxstudio.onrender.com";

test("mediaSrc: /media/ diawali alamat API, selain itu apa adanya", () => {
  assert.equal(mediaSrc("/media/1-ab.jpg", RENDER), RENDER + "/media/1-ab.jpg");
  assert.equal(mediaSrc("/media/1-ab.jpg", ""), "/media/1-ab.jpg");
  assert.equal(mediaSrc("/img/studio-1.jpg", RENDER), "/img/studio-1.jpg");
  assert.equal(mediaSrc("https://cdn.example.com/a.jpg", RENDER), "https://cdn.example.com/a.jpg");
  assert.equal(mediaSrc("", RENDER), "");
  assert.equal(mediaSrc(null, RENDER), "");
});

test("mediaSrc: bawaan memakai API_BASE (kosong di Node = satu origin)", () => {
  assert.equal(mediaSrc("/media/x.jpg"), "/media/x.jpg");
});

test("backgroundImage: memakai mediaSrc dan meng-escape URL", () => {
  assert.equal(String(backgroundImage("/media/x.jpg", RENDER)), `background-image:url('${RENDER}/media/x.jpg')`);
  assert.equal(String(backgroundImage("/img/a'b.jpg", RENDER)), "background-image:url('/img/a&#39;b.jpg')");
  assert.equal(String(backgroundImage("", RENDER)), "");
});

test("propertyVisual: gambar unggahan tampil sebagai latar", () => {
  assert.match(String(propertyVisual({ img: "/media/p.jpg" })), /background-image:url\('\/media\/p\.jpg'\)/);
});
