// 生成应用图标 logo.png（192×192，圆形，外部透明）
// 设计：深绿圆底 + 米色棋盘圆 + 棕色网格 + 黑白两枚棋子
import zlib from 'zlib';
import fs from 'fs';

const S = 192;
const px = new Uint8Array(S * S * 4);
const CX = (S - 1) / 2;
const CY = (S - 1) / 2;

const OUT_R = 93; // 外圆
const IN_R = 76; // 内盘
const LINE_W = 2;

function set(i, r, g, b, a) {
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}

// 网格线位置（在内盘上均匀 4 条，形成 4×4 的格子感）
const GRID = [46, 74, 102, 130];

// 棋子：交点上的黑白子（半径 15）
const STONES = [
  { x: 74, y: 74, r: 15, c: [20, 24, 28] }, // 黑子
  { x: 102, y: 102, r: 15, c: [250, 250, 250] } // 白子
];

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const dx = x - CX;
    const dy = y - CY;
    const d2 = dx * dx + dy * dy;

    // 圆外：透明（不再有方形的绿色边）
    if (d2 > OUT_R * OUT_R) {
      set(i, 0, 0, 0, 0);
      continue;
    }
    // 外圈深绿
    set(i, 23, 51, 29, 255);

    // 内盘：主题绿
    if (d2 <= (IN_R + 4) * (IN_R + 4)) set(i, 47, 158, 68, 255);
    if (d2 <= IN_R * IN_R) set(i, 233, 211, 166, 255);

    // 网格线（内盘内）
    if (d2 <= IN_R * IN_R) {
      for (const g of GRID) {
        if (Math.abs(x - g) <= LINE_W / 2 || Math.abs(y - g) <= LINE_W / 2) {
          set(i, 138, 106, 58, 255);
          break;
        }
      }
    }

    // 棋子
    for (const s of STONES) {
      const sdx = x - s.x;
      const sdy = y - s.y;
      if (sdx * sdx + sdy * sdy <= s.r * s.r) {
        set(i, s.c[0], s.c[1], s.c[2], 255);
      }
    }
  }
}

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
}

const table = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync('/workspace/repo/src/common/logo.png', png);
console.log('logo.png ' + png.length + ' bytes（圆形图标，外部透明）');