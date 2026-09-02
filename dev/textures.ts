import { Application, Sprite, Text, type Texture } from "pixi.js";
import { loadAssetPack } from "../src/render/atlas.ts";
import { autotileIndex } from "../src/render/packs/autotile.ts";
import type { Facing, ResourceKind, TerrainKind } from "../src/sim/types.ts";

const app = new Application();
await app.init({ width: 1400, height: 1000, background: "#555555", antialias: false, resolution: 1 });
document.body.appendChild(app.canvas);
const pack = await loadAssetPack(app.renderer);

const Z = 4;
let y = 12;
const label = (t: string, yy: number) => {
  const text = new Text({ text: t, style: { fontSize: 12, fill: "#fff", fontFamily: "monospace" } });
  text.x = 12; text.y = yy; app.stage.addChild(text);
};
function row(name: string, textures: readonly Texture[]): void {
  if (textures.length === 0) return;
  label(name, y + 12);
  let x = 190;
  let tallest = 0;
  for (const texture of textures) {
    const sprite = new Sprite(texture);
    sprite.scale.set(Z); sprite.x = x; sprite.y = y;
    app.stage.addChild(sprite);
    x += texture.width * Z + 8;
    tallest = Math.max(tallest, texture.height);
  }
  y += tallest * Z + 12;
}

// every autotile shape, in the 3x5 block order
const kinds: TerrainKind[] = ["grass", "underbrush", "mud", "tree", "stream", "rock"];
for (const kind of kinds) {
  const masks = Array.from({ length: 15 }, (_, i) => i);
  const seen = new Map<number, number>();
  for (let m = 0; m < 256; m++) if (!seen.has(autotileIndex(m))) seen.set(autotileIndex(m), m);
  row(kind, masks.map((i) => pack.ground(kind, seen.get(i) ?? 0, i, 0)));
}
row("stream frame 1", Array.from({ length: 15 }, (_, i) => pack.ground("stream", 255, i, 1)));
for (const kind of ["tree", "underbrush"] as TerrainKind[]) {
  const props: Texture[] = [];
  for (let v = 0; v < 400; v++) { const p = pack.prop(kind, v); if (p && !props.includes(p.texture)) props.push(p.texture); }
  row(`prop ${kind}`, props);
}
row("resources", (["fruit", "water", "ore"] as ResourceKind[]).map((k) => pack.resource(k).texture));
row("camp", [pack.camp.texture]);
for (const f of ["southEast", "southWest", "northEast", "northWest"] as Facing[]) row(`walk ${f}`, pack.walk(f));
label(`pack: ${pack.id}  tileSize ${pack.tileSize}px`, 4);
