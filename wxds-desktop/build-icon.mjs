/* 生成应用图标：icon.png (256x256) + icon.ico（纯 node，无依赖）
 * 设计：圆角方块蓝灰渐变底 + 打开的书（左右两页 + 三行文字） */
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const OUT = process.cwd();

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- 4x 超采样绘制（内部位图 1024） ---------- */
const W = 256, SS = 4, B = W * SS;
const img = Buffer.alloc(B * B * 4);

function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r || (px >= x + r && px <= x + w - r) || (py >= y + r && py <= y + h - r);
}
const lerp = (a, b, t) => a + (b - a) * t;

const BG1 = [104, 126, 158], BG2 = [58, 71, 100];
const PAGE_L = [255, 255, 255], PAGE_R = [243, 246, 250];
const SPINE = [214, 222, 234];
const LINE = [150, 164, 188];

/* 书页几何（1024 空间） */
const bx = 46 * SS, by = 74 * SS, bw = B - 92 * SS, bh = 124 * SS;
/* 三行文字条：y 位置（256 空间），条高 11px */
const LINES = [102, 140, 178].map(v => v * SS);
const LH = 11 * SS;

for (let y = 0; y < B; y++) {
  for (let x = 0; x < B; x++) {
    let r = 0, g = 0, b = 0, a = 0;

    /* 圆角方块渐变底 */
    if (inRoundRect(x, y, 8, 8, B - 16, B - 16, 46 * SS)) {
      const t = y / B;
      r = lerp(BG1[0], BG2[0], t); g = lerp(BG1[1], BG2[1], t); b = lerp(BG1[2], BG2[2], t);
      a = 255;
    }

    /* 打开的书 */
    if (inRoundRect(x, y, bx, by, bw, bh, 10 * SS)) {
      const right = x > B / 2;
      r = right ? PAGE_R[0] : PAGE_L[0];
      g = right ? PAGE_R[1] : PAGE_L[1];
      b = right ? PAGE_R[2] : PAGE_L[2];
      /* 中缝阴影 */
      if (Math.abs(x - B / 2) < 3 * SS) { r = SPINE[0]; g = SPINE[1]; b = SPINE[2]; }
      /* 三行"文字"（左右两页各三条圆角条） */
      const lw = 52 * SS;
      const lx = right ? B / 2 + 13 * SS : B / 2 - 13 * SS - lw;
      for (const ly of LINES) {
        if (inRoundRect(x, y, lx, ly, lw, LH, LH / 2)) {
          r = LINE[0]; g = LINE[1]; b = LINE[2];
        }
      }
    }

    const i = (y * B + x) * 4;
    img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = a;
  }
}

/* 4x 盒式降采样 → 256 */
const out = Buffer.alloc(W * W * 4);
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) {
      for (let dx = 0; dx < SS; dx++) {
        const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
        r += img[i]; g += img[i + 1]; b += img[i + 2]; a += img[i + 3];
      }
    }
    const n = SS * SS, o = (y * W + x) * 4;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
  }
}

const png = encodePNG(out, W, W);
fs.writeFileSync(path.join(OUT, 'icon.png'), png);

/* ---------- ICO（单张 256 PNG 载荷） ---------- */
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);            // reserved
header.writeUInt16LE(1, 2);            // type: icon
header.writeUInt16LE(1, 4);            // count
const entry = Buffer.alloc(16);
entry[0] = 0;                          // width 256 → 0
entry[1] = 0;                          // height 256 → 0
entry[2] = 0;                          // palette
entry[3] = 0;                          // reserved
entry.writeUInt16LE(1, 4);             // planes
entry.writeUInt16LE(32, 6);            // bit count
entry.writeUInt32LE(png.length, 8);    // bytes in resource
entry.writeUInt32LE(22, 12);           // offset = 6 + 16
fs.writeFileSync(path.join(OUT, 'icon.ico'), Buffer.concat([header, entry, png]));

console.log('icon.png / icon.ico 已生成（PNG ' + png.length + ' 字节）');
