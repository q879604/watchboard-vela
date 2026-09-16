import zlib from 'zlib';
import fs from 'fs';

const S = 192;
const px = new Uint8Array(S * S * 4);

function insideRound(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
const set = (i, r, g, b, a) => { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };

const GRID = [58, 96, 134];
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (!insideRound(x, y, 0, 0, S - 1, S - 1, 44)) { set(i, 0, 0, 0, 0); continue; }
    set(i, 47, 158, 68, 255);                                     // 主题绿底
    if (insideRound(x, y, 36, 36, 156, 156, 14)) {                // 棋盘
      set(i, 233, 211, 166, 255);
      let line = false;
      for (const g of GRID) if (Math.abs(x - g) <= 1 || Math.abs(y - g) <= 1) line = true;
      if (line) set(i, 138, 106, 58, 255);
    }
    const stones = [[58, 58, 14, 20, 24, 28], [96, 96, 14, 247, 247, 247], [134, 134, 12, 20, 24, 28]];
    for (const s of stones) {
      const dx = x - s[0], dy = y - s[1];
      if (dx * dx + dy * dy <= s[2] * s[2]) set(i, s[3], s[4], s[5], 255);
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
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync('/workspace/repo/src/common/logo.png', png);
console.log('logo.png ' + png.length + ' bytes');
