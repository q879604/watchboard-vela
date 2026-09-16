# 环上桌游（Watch Board Games）

小米手环 / 手表（Vela OS）上的桌游合集快应用。目标设备：小米手环 9 Pro（336×480）、
手环 8 Pro / 10 / REDMI Watch 等 Vela 穿戴设备（布局按屏幕实际宽度自适应）。

## 游戏状态

| 游戏 | 状态 | 说明 |
| --- | --- | --- |
| 五子棋 | ✅ | 11×11 棋盘；单人（三档难度 AI）/ 双人同表；悔棋、重开、光标辅助 |
| UNO | ✅ | 2~4 人（你 + 1~3 AI）；108 张牌，禁/反/+2/变色/+4 全实现 |
| 谁是卧底 | ✅ | 4~8 人传阅发词，30 组词库，随机发言顺序 |
| 规则 / 关于 | ✅ | |
| 大富翁 / 狼人杀 / 扑克牌类 / 三国杀 | 🚧 未开发 | 菜单中为灰色卡片，点击提示「开发中」 |

## 云端构建（无需 PC 端 AIoT-IDE）

打包器是公开 npm 包 `aiot-toolkit`，所以可以直接在 GitHub Actions 里出 rpk：

- `.github/workflows/ci.yml`：push / 手动触发 → `aiot build` → 下载 Actions 里的 `rpk` artifact
- `.github/workflows/release.yml`：推 `v*` tag → 构建并发布到 Releases（无证书时自动出 debug 包，可直接装表）

本地开发（需 AIoT-IDE 提供模拟器）：

```bash
npm install
npm run start     # 模拟器实时预览
npm run build     # dist/*.debug.rpk
npm run release   # 需 sign/ 下证书
```

## 安装到手表

云端只产出 rpk，装机仍需侧载：**小米运动健康 → 我的 → 关于 → Debug → 第三方应用 → Install third app**，
或使用 AstroBox / 社区 ADB 脚本（`oryonatan/xiaomi-band-development`）。

## 结构

```
src/
├── manifest.json          包名 / 路由 / features / designWidth
├── app.ux                 应用级生命周期与全局数据（棋盘边长等）
├── common/
│   ├── theme.css          全局视觉（纯色 + rgba，不用渐变）
│   ├── gomoku-ai.js       五子棋 AI（窗口计数评分 + 成五/封堵优先 + 一步预判）
│   ├── uno.js             UNO 引擎（108 张牌、效果牌、AI 出牌策略）
│   └── logo.png           应用图标（tools/gen-icon.mjs 生成）
── pages/
    ├── home/              桌游清单（入口）
    ├── gomoku/            五子棋
    ├── uno/               UNO
    ├── whois/             谁是卧底
    ├── rules/             规则
    ── about/             关于
```

## 引擎自测

`gomoku-ai.js` 与 `uno.js` 是纯函数模块，可在 node 下直接跑：

```bash
# 五子棋：封堵活四 / 自己成五优先 / 四方向判胜 / 强度梯度
# UNO：发牌 108 张 / 双人反转 / +2 摸牌跳过 / 出完判胜 / 200 局无死循环
```

实测结论（见 commit 说明）：五子棋 AI 单步 < 5ms、普通档 vs 新手档 20:0；
UNO 200 局全部正常结束、无牌数泄漏；难度靠「失误率」而非权重（零失误必然满盘平局）。

## Vela 限制备忘

- 只支持 class 选择器，无 `:hover` / 后代选择器 / 伪类
- 文字必须在 `<text>` 内且不换行；滚动要 `<scroll scroll-y="true">` + 显式高度
- 无 `window` / `document`；文件只有 `internal://` 协议
- 渐变支持不稳，一律纯色
- `for` 循环的 `tid` 键从 1 开始（键 0 会让首项更新失效）