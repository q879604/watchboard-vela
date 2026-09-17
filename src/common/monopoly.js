/**
 * 大富翁（简化版）引擎 —— 纯函数。
 * 环形 24 格：起点 / 地产(可买可升级) / 机会 / 税 / 监狱(停一轮)，含白云机场、阿尔卑斯山等地标。
 * 资金与人数由开局面板决定；支持真人 + 电脑混编。
 * 经济模型（实测调参）：过起点 +400；租金 = ceil(房价×30%/10)×10×(1+等级)；
 *   破产出局；60 回合后按总资产定胜负。
 */

export const CELL_COUNT = 24;
export const PASS_SALARY = 400;
export const MAX_ROUNDS = 60;

export const MONEY_OPTIONS = [2000, 5000, 10000, 15000];

const CHANCES = [
  { text: '发奖金 +300', money: 300 },
  { text: '交罚款 -200', money: -200 },
  { text: '捡到钱 +150', money: 150 },
  { text: '意外支出 -100', money: -100 },
  { text: '回到起点 +400', jump: 0 },
  { text: '后退 3 格', back: 3 },
  { text: '补缴税款 -300', money: -300 },
  { text: '投资收益 +250', money: 250 }
];

const LAYOUT = [
  { t: 'start', name: '起点' },
  { t: 'prop', name: '越南', price: 300 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '韩国', price: 350 },
  { t: 'tax', name: '税', amount: 200 },
  { t: 'prop', name: '日本', price: 400 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '俄罗斯', price: 450 },
  { t: 'prop', name: '德国', price: 500 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '法国', price: 550 },
  { t: 'prop', name: '西班牙', price: 600 },
  { t: 'jail', name: '监狱' },
  { t: 'prop', name: '意大利', price: 650 },
  { t: 'tax', name: '税', amount: 400 },
  { t: 'prop', name: '美国', price: 700 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '墨西哥', price: 800 },
  { t: 'prop', name: '白云机场', price: 900 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '阿尔卑斯山', price: 1000 },
  { t: 'prop', name: '阿根廷', price: 1100 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '澳大利亚', price: 1200 }
];

export const BOARD = LAYOUT;

export function rentOf(cell, level) {
  return Math.ceil((cell.price * 0.3) / 10) * 10 * (level + 1);
}

/** count=总人数；money=初始资金 */
export function createGame(count, money) {
  const start = money || MONEY_OPTIONS[0];
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push({ money: start, pos: 0, props: [], alive: true, skip: 0 });
  }
  return { players: players, current: 0, round: 1, log: ['开局：每人 ¥' + start] };
}

export function rollDice() {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return { a: a, b: b, sum: a + b };
}

function pushLog(s, t) {
  s.log.push(t);
  if (s.log.length > 6) s.log.shift();
}

export function move(s, steps) {
  const p = s.players[s.current];
  const from = p.pos;
  p.pos = (p.pos + steps) % CELL_COUNT;
  if (from + steps >= CELL_COUNT) {
    p.money += PASS_SALARY;
    pushLog(s, (s.current + 1) + '号 过起点 +' + PASS_SALARY);
  }
  return { passed: from + steps >= CELL_COUNT, landed: p.pos };
}

function findOwner(s, cellIdx) {
  for (let i = 0; i < s.players.length; i++) {
    const e = s.players[i].props.find((q) => q.i === cellIdx);
    if (e) return { player: i, level: e.level };
  }
  return null;
}

export function settle(s) {
  const p = s.players[s.current];
  const cell = BOARD[p.pos];
  if (cell.t === 'prop') {
    const ow = findOwner(s, p.pos);
    if (ow && ow.player === s.current) return { type: 'own', cell: p.pos, name: cell.name, level: ow.level };
    if (ow) {
      const rent = rentOf(cell, ow.level);
      p.money -= rent;
      s.players[ow.player].money += rent;
      pushLog(s, (s.current + 1) + '号 付租 ' + rent + ' 给 ' + (ow.player + 1) + '号');
      return { type: 'rent', amount: rent, owner: ow.player, cell: p.pos, name: cell.name };
    }
    return { type: 'buy', price: cell.price, cell: p.pos, name: cell.name };
  }
  if (cell.t === 'tax') {
    p.money -= cell.amount;
    pushLog(s, (s.current + 1) + '号 缴税 ' + cell.amount);
    return { type: 'tax', amount: cell.amount, name: cell.name };
  }
  if (cell.t === 'jail') {
    p.skip = 1;
    pushLog(s, (s.current + 1) + '号 进了监狱，下回合暂停');
    return { type: 'jail', name: cell.name };
  }
  if (cell.t === 'chance') {
    const card = CHANCES[Math.floor(Math.random() * CHANCES.length)];
    if (card.money != null) {
      p.money += card.money;
      pushLog(s, card.text);
      return { type: 'chance', card: card };
    }
    if (card.jump != null) {
      p.pos = card.jump;
      p.money += PASS_SALARY;
      pushLog(s, card.text);
      return { type: 'chance', card: card, landed: p.pos };
    }
    if (card.back != null) {
      p.pos = Math.max(0, p.pos - card.back);
      pushLog(s, card.text);
      return { type: 'chance', card: card, landed: p.pos };
    }
  }
  return { type: 'info', name: cell.name };
}

export function buyProp(s, cellIdx) {
  const p = s.players[s.current];
  const cell = BOARD[cellIdx];
  p.money -= cell.price;
  p.props.push({ i: cellIdx, level: 0 });
  pushLog(s, (s.current + 1) + '号 买入 ' + cell.name);
}

export function upgradeProp(s, cellIdx) {
  const p = s.players[s.current];
  const e = p.props.find((q) => q.i === cellIdx);
  if (!e || e.level >= 2) return { ok: false, msg: '不能再升级' };
  const cost = BOARD[cellIdx].price;
  if (p.money < cost) return { ok: false, msg: '钱不够升级' };
  p.money -= cost;
  e.level++;
  pushLog(s, (s.current + 1) + '号 升级 ' + BOARD[cellIdx].name + ' Lv' + (e.level + 1));
  return { ok: true, cost: cost, level: e.level };
}

export function checkBankrupt(s) {
  const p = s.players[s.current];
  if (p.money < 0 && p.props.length) {
    // 先变卖地产（半价）抵债，卖光仍为负才算破产
    while (p.money < 0 && p.props.length) {
      const e = p.props.pop();
      p.money += Math.floor(BOARD[e.i].price / 2);
      pushLog(s, (s.current + 1) + '号 变卖 ' + BOARD[e.i].name);
    }
  }
  if (p.money < 0) {
    p.alive = false;
    pushLog(s, (s.current + 1) + '号 破产出局');
    return true;
  }
  return false;
}

/** 轮转到下一个存活玩家，并处理监狱暂停 */
export function endTurn(s) {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    s.current = (s.current + 1) % n;
    if (s.current === 0) s.round++;
    const p = s.players[s.current];
    if (!p.alive) continue;
    if (p.skip > 0) {
      p.skip--;
      pushLog(s, (s.current + 1) + '号 监狱中，暂停一回合');
      continue;
    }
    return { done: false, round: s.round };
  }
  return { done: true, round: s.round };
}

export function aliveCount(s) {
  let c = 0;
  let last = -1;
  for (let i = 0; i < s.players.length; i++) {
    if (s.players[i].alive) {
      c++;
      last = i;
    }
  }
  return { count: c, last: last };
}

export function wealthOf(p) {
  let w = Math.max(0, p.money);
  for (const e of p.props) w += BOARD[e.i].price;
  return w;
}

export function roundWinner(s) {
  let best = -1;
  let bestW = -1;
  for (let i = 0; i < s.players.length; i++) {
    if (s.players[i].alive && wealthOf(s.players[i]) > bestW) {
      bestW = wealthOf(s.players[i]);
      best = i;
    }
  }
  return { player: best, wealth: bestW };
}

/** 棋盘格在「可滚动网格」里的顺序（3 列 × 8 行，起点在最上方） */
export function gridOrder() {
  const out = [];
  for (let i = 0; i < CELL_COUNT; i++) out.push(i);
  return out;
}