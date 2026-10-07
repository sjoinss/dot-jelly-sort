/**
 * PWA 아이콘 PNG 만들기: 기본 젤리 두 개가 이어진 모습. 외부 라이브러리 없이 zlib만 쓴다.
 * 실행: node scripts/make-icons.mts  (Node 23.6+ 타입 제거 지원 필요)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { DEFAULT_INNER, INK, JELLY_H, JELLY_W, jellyPixels, shadeOf } from "../src/sprites/jelly.ts";

const BG = [0xff, 0xe3, 0xef]; // --color-primary-soft

type Icon = { file: string; size: number; cell: number };

const ICONS: Icon[] = [
  { file: "icon-192.png", size: 192, cell: 5 },
  { file: "apple-touch-icon.png", size: 180, cell: 5 },
  { file: "icon-512.png", size: 512, cell: 14 },
  // maskable은 가운데 80% 원 안에 들어가도록 작게
  { file: "icon-maskable-512.png", size: 512, cell: 10 },
];
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, rgba: Buffer) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const body = "#ff6b6b";
const colors = { body, shade: shadeOf(body), outline: INK };
const top = jellyPixels(DEFAULT_INNER, colors, { connectUp: false, connectDown: true });
const bottom = jellyPixels(DEFAULT_INNER, colors, { connectUp: true, connectDown: false });
const dots = [...top, ...bottom];
const W = JELLY_W;
const H = JELLY_H * 2;

mkdirSync("public/icons", { recursive: true });
for (const icon of ICONS) {
  const { size, cell } = icon;
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set([...BG, 255], i * 4);
  const ox = Math.floor((size - W * cell) / 2);
  const oy = Math.floor((size - H * cell) / 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = dots[y * W + x];
      if (!c) continue;
      const n = parseInt(c.slice(1), 16);
      for (let dy = 0; dy < cell; dy++)
        for (let dx = 0; dx < cell; dx++) rgba.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], ((oy + y * cell + dy) * size + ox + x * cell + dx) * 4);
    }
  writeFileSync(`public/icons/${icon.file}`, png(size, rgba));
  console.log(icon.file);
}
