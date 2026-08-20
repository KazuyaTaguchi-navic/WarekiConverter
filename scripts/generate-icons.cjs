// アイコンPNGを外部ツールなしで生成するワンショットスクリプト（zlibのみ使用）
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// shapeFn(x, y, size) はアンチエイリアス用にサブピクセル座標(浮動小数)で呼ばれ、[r,g,b,a] を返す
const SUPERSAMPLE = 4;

function makePng(size, shapeFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = size * 4;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const fx = x + (sx + 0.5) / SUPERSAMPLE;
          const fy = y + (sy + 0.5) / SUPERSAMPLE;
          const [r, g, b, a] = shapeFn(fx, fy, size);
          rSum += r * a;
          gSum += g * a;
          bSum += b * a;
          aSum += a;
        }
      }
      const total = SUPERSAMPLE * SUPERSAMPLE * 255;
      const aOut = Math.round((aSum / total) * 255);
      const rOut = aSum > 0 ? Math.round(rSum / aSum) : 0;
      const gOut = aSum > 0 ? Math.round(gSum / aSum) : 0;
      const bOut = aSum > 0 ? Math.round(bSum / aSum) : 0;
      const o = rowStart + 1 + x * 4;
      raw[o] = rOut; raw[o + 1] = gOut; raw[o + 2] = bOut; raw[o + 3] = aOut;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function inRoundedRect(px, py, rx, ry, rw, rh, radius) {
  if (px < rx || px > rx + rw || py < ry || py > ry + rh) return false;
  const left = px - rx;
  const top = py - ry;
  const right = rx + rw - px;
  const bottom = ry + rh - py;
  const r = radius;
  if (left < r && top < r) return (r - left) ** 2 + (r - top) ** 2 <= r * r;
  if (right < r && top < r) return (r - right) ** 2 + (r - top) ** 2 <= r * r;
  if (left < r && bottom < r) return (r - left) ** 2 + (r - bottom) ** 2 <= r * r;
  if (right < r && bottom < r) return (r - right) ** 2 + (r - bottom) ** 2 <= r * r;
  return true;
}

function sign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

const TRANSPARENT = [0, 0, 0, 0];
const NAVY = [26, 42, 74, 255]; // バッジ背景
const WHITE = [255, 255, 255, 255]; // 矢印(⇔)

// 角丸四角の紺色バッジの中央に、白い双方向矢印（⇔）を配置したシンプルなデザイン。
function shapeFn(x, y, size) {
  const outerRadius = size * 0.22;
  if (!inRoundedRect(x, y, 0, 0, size, size, outerRadius)) return TRANSPARENT;

  const cy = 0.5 * size;
  const barThickness = 0.16 * size;
  const headWidth = 0.24 * size;
  const headHeight = 0.4 * size;
  const leftX = 0.14 * size;
  const rightX = 0.86 * size;

  const barX0 = leftX + headWidth;
  const barX1 = rightX - headWidth;
  const barY0 = cy - barThickness / 2;
  const barY1 = cy + barThickness / 2;

  if (x >= barX0 && x <= barX1 && y >= barY0 && y <= barY1) return WHITE;

  if (pointInTriangle(x, y, leftX, cy, barX0, cy - headHeight / 2, barX0, cy + headHeight / 2)) return WHITE;
  if (pointInTriangle(x, y, rightX, cy, barX1, cy - headHeight / 2, barX1, cy + headHeight / 2)) return WHITE;

  return NAVY;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const buf = makePng(size, shapeFn);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
  console.log(`generated icon${size}.png`);
}
