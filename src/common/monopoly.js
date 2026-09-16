/**
 * 大富翁（简化版）引擎 —— 纯函数，同表 2~4 人轮流玩，无 AI。
 * 环形 24 格：起点 + 地产(买入/收租/升级) + 机会(抽卡) + 税。
 *
 * 经济模型（实测调参，避免死局）：
 *   过起点 +100；租金 = 房价×35%×(1+等级)，等级 0/1/2；
 *   买地后可花等额房价升级一次（+1 档租金），制造资金外流 → 破产收场。
 */

export const CELL_COUNT = 24;
export const START_MONEY = 800;
export const PASS_SALARY = 100;

const CHANCES = [
  { text: '发奖金', money: 200 },
  { text: '交罚款', money: -100 },
  { text: '捡到钱', money: 100 },
  { text: '意外支出', money: -50 },
  { text: '回到起点领薪水', jump: 0 },
  { text: '后退 3 格', back: 3 },
  { text: '补缴税款', money: -150 },
  { text: '投资收益', money: 150 }
];

const LAYOUT = [
  { t: 'start', name: '起点' },
  { t: 'prop', name: '北京路', price: 60 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '上海路', price: 60 },
  { t: 'tax', name: '税', amount: 100 },
  { t: 'prop', name: '广州路', price: 80 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '深圳路', price: 80 },
  { t: 'prop', name: '成都路', price: 100 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '杭州路', price: 100 },
  { t: 'prop', name: '武汉路', price: 120 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '南京路', price: 120 },
  { t: 'tax', name: '税', amount: 160 },
  { t: 'prop', name: '西安路', price: 140 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '重庆路', price: 140 },
  { t: 'prop', name: '天津路', price: 160 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '香港路', price: 180 },
  { t: 'prop', name: '澳门路', price: 200 },
  { t: 'chance', name: '机会' },
  { t: 'prop', name: '台北路', price: 220 }
];

export const BOARD = LAYOUT;

export function rentOf(cell, level) {
  return Math.ceil((cell.price * 0.35) / 5) * 5 * (level + 1);
}

export function createGame(count) {
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push({ money: START_MONEY, pos: 0, props: [], alive: true });
  }
  return { players: players, current: 0, round: 1, log: ['1号 开局'] };
}

export function rollDice() {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return { a: a, b: b, sum: a + b };
}

function pushLog(s, t) {
  s.log.push(t);
  if (s.log.length > 4) s.log.shift();
}

/** 前进 steps 格；经过起点发工资 */
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

/** 落到某格后的结算，返回给 UI 的事件对象 */
export function settle(s) {
  const p = s.players[s.current];
  const cell = BOARD[p.pos];
  if (cell.t === 'prop') {
    const ow = findOwner(s, p.pos);
    if (ow && ow.player === s.current) {
      pushLog(s, '自己的地产');
      return { type: 'own', cell: p.pos, name: cell.name, level: ow.level };
    }
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
    return { type: 'tax', amount: cell.amount };
  }
  if (cell.t === 'chance') {
    const card = CHANCES[Math.floor(Math.random() * CHANCES.length)];
    if (card.money != null) {
      p.money += card.money;
      pushLog(s, card.text + (card.money >= 0 ? ' +' : ' ') + card.money);
      return { type: 'chance', card: card };
    }
    if (card.jump != null) {
      p.pos = card.jump;
      p.money += PASS_SALARY;
      pushLog(s, card.text + '（+' + PASS_SALARY + '）');
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

/** 买地：扣钱 + 记入资产 */
export function buyProp(s, cellIdx) {
  const p = s.players[s.current];
  const cell = BOARD[cellIdx];
  p.money -= cell.price;
  p.props.push({ i: cellIdx, level: 0 });
  pushLog(s, (s.current + 1) + '号 买入 ' + cell.name);
}

/** 升级自己的地产（+1 档租金，最多 2 档）；花等额房价 */
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
  if (p.money < 0) {
    p.alive = false;
    pushLog(s, (s.current + 1) + '号 破产出局');
    return true;
  }
  return false;
}

export function endTurn(s) {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    s.current = (s.current + 1) % n;
    if (s.current === 0) s.round++;
    if (s.players[s.current].alive) return { done: false, round: s.round };
  }
  return { done: true, round: s.round };
}

/** 玩家总资产 = 现金 + 地产价值 */
export function wealthOf(p) {
  let w = Math.max(0, p.money);
  for (const e of p.props) w += BOARD[e.i].price;
  return w;
}

/** 总资产最高的存活玩家（回合上限结算用） */
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

/** 棋盘环形坐标（供页面渲染）：按矩形周边排布，24 格 = 每边 6 格 */
export function ringPositions(size) {
  const out = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const side = Math.floor(i / 6);
    const t = i % 6;
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = size - t * (size / 6);
      y = size;
    } else if (side === 1) {
      x = 0;
      y = size - t * (size / 6);
    } else if (side === 2) {
      x = t * (size / 6);
      y = 0;
    } else {
      x = size;
      y = t * (size / 6);
    }
    out.push({ x: Math.round(x), y: Math.round(y) });
  }
  return out;
}