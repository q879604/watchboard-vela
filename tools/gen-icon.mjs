// 生成应用图标 logo.png（192×192）
// 设计：满幅圆形（无边框）绿色底 + 卡牌 + 骰子 + 筹码，体现「桌游合集」而不是只有五子棋
import zlib from 'zlib';
import fs from 'fs';

const S = 192;
const px = new Uint8Array(S * S * 4);
const CX = (S - 1) / 2;
const CY = (S - 1) / 2;

const R = 95; // 直接顶满画布，不留边框
const GREEN = [47, 158, 68];
const WHITE = [253, 253, 253];
const DARK = [23, 51, 29];
const RED = [214, 69, 69];
const BLUE = [43, 108, 176];
const GOLD = [242, 201, 76];

function set(i, c, a) {
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = a == null ? 255 : a;
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// 布局：左上一张牌，右下一颗骰子，左下筹码
const CARD = [40, 34, 96, 118, 10]; // x0,y0,x1,y1,圆角
const DIE = [98, 84, 152, 138, 14];
const PIPS = [[112, 99], [138, 124], [125, 111]]; // 骰子三点
const CHIP_C = [62, 140];
const CHIP_R = 18;

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (!inCircle(x, y, CX, CY, R)) {
      set(i, [0, 0, 0], 0); // 圆外透明
      continue;
    }
    set(i, GREEN);

    // 筹码（左下）：金圆 + 深色内环 + 中心白点
    if (inCircle(x, y, CHIP_C[0], CHIP_C[1], CHIP_R)) {
      set(i, GOLD);
      if (inCircle(x, y, CHIP_C[0], CHIP_C[1], CHIP_R - 5)) set(i, DARK);
      if (inCircle(x, y, CHIP_C[0], CHIP_C[1], CHIP_R - 10)) set(i, GOLD);
      if (inCircle(x, y, CHIP_C[0], CHIP_C[1], 4)) set(i, WHITE);
    }

    // 卡牌（左上）：白底 + 红蓝两色花色点
    if (inRoundRect(x, y, CARD[0], CARD[1], CARD[2], CARD[3], CARD[4])) {
      set(i, WHITE);
      if (inCircle(x, y, 68, 62, 13)) set(i, RED);
      if (inCircle(x, y, 68, 92, 11)) set(i, BLUE);
    }

    // 骰子（右下）：白底圆角 + 三点
    if (inRoundRect(x, y, DIE[0], DIE[1], DIE[2], DIE[3], DIE[4])) {
      set(i, WHITE);
      for (const p of PIPS) {
        if (inCircle(x, y, p[0], p[1], 6)) set(i, DARK);
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
console.log('logo.png ' + png.length + ' bytes（满幅圆形，无边框：卡牌+骰子+筹码）');