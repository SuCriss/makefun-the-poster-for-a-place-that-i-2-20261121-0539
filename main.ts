// make.fun the-poster-for-a-place-that-i-2-20261121-0539 authored travel poster.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const WIDTH = 1024;
const HEIGHT = 1024;

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const stride = 1 + WIDTH * 4;
const raw = Buffer.alloc(HEIGHT * stride);
const horizon = Math.floor(HEIGHT * 0.62);
const sunX = 512;
const sunY = horizon - 250;
const sunR = 110;
const border = 18;

for (let y = 0; y < HEIGHT; y++) {
  const row = y * stride;
  raw[row] = 0;
  for (let x = 0; x < WIDTH; x++) {
    const p = row + 1 + x * 4;
    let r;
    let g;
    let b;

    if (x < border || x >= WIDTH - border || y < border || y >= HEIGHT - border) {
      r = 236;
      g = 226;
      b = 198;
    } else if (y >= horizon) {
      const depth = (y - horizon) / (HEIGHT - horizon);
      r = Math.floor(34 - depth * 14);
      g = Math.floor(26 - depth * 10);
      b = Math.floor(48 - depth * 16);
    } else {
      const t = y / horizon;
      r = Math.floor(26 + t * 214);
      g = Math.floor(22 + t * 104);
      b = Math.floor(64 + t * 10);

      const dx = x - sunX;
      const dy = y - sunY;
      const d2 = dx * dx + dy * dy;
      const r2 = sunR * sunR;
      if (d2 <= r2) {
        const glow = 1 - d2 / r2;
        r = Math.min(255, Math.floor(250 + glow * 5));
        g = Math.floor(196 + glow * 40);
        b = Math.floor(96 + glow * 40);
      } else if (d2 <= (sunR + 40) * (sunR + 40)) {
        const glow = 1 - (Math.sqrt(d2) - sunR) / 40;
        r = Math.min(255, Math.floor(r + glow * 40));
        g = Math.min(255, Math.floor(g + glow * 30));
        b = Math.min(255, Math.floor(b + glow * 10));
      }

      const backRidge = horizon - 170 - 45 * Math.sin(x / 110) - 25 * Math.sin(x / 47 + 1.3);
      const frontRidge = horizon - 60 - 38 * Math.sin(x / 78 + 0.5) - 22 * Math.sin(x / 33 + 2.1);
      if (y >= frontRidge) {
        r = 46;
        g = 38;
        b = 70;
      } else if (y >= backRidge) {
        r = 78;
        g = 64;
        b = 104;
      }
    }

    raw[p] = r;
    raw[p + 1] = g;
    raw[p + 2] = b;
    raw[p + 3] = 255;
  }
}

const idat = zlib.deflateSync(raw);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', idat),
  makeChunk('IEND', Buffer.alloc(0)),
]);

const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'entry.png'), png);
