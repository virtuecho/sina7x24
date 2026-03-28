# 新浪财经 7x24 查看器

[English README](./README.md)

这是一个通过同源代理浏览新浪财经 7x24 直播流的小型 Web 项目。它在原始直播流之上补充了更清晰的阅读体验、消息检查能力、更丰富的过滤器，以及一个可选的 Discord 转发面板。

## 功能

- 通过同源代理浏览新浪财经 7x24 数据流
- 按正文、消息 ID、时间文本搜索
- 通过主下拉按“评论：有”“来源：有”和标签分类过滤，并提供单独的焦点按钮
- 将标题与末尾来源提取为单独显示区域
- 在独立弹窗中查看原始属性和评论数据
- 自动刷新最新消息，并支持按需加载更早历史
- 通过顶部粘性控制面板切换项目上限和最新刷新行为
- 通过白名单头像代理安全加载头像资源
- 通过可选的 Discord Webhook 功能转发直播消息
- 同时支持本地 Express 路由和 Pages Functions 风格的无服务器路由

## 项目结构

- `index.html` — 页面骨架与静态挂载点
- `scripts/core/viewer-core.js` — 数据流生命周期、过滤、渲染、统计和弹窗
- `scripts/features/discord/` — 可选的 Discord 转发功能
- `scripts/app.js` — 前端启动入口
- `styles/` — 主页面样式和 Discord 专用样式
- `backend/core/` — 运行时无关的后端处理器与共享校验规则
- `server/` — 本地 Node 适配层与应用装配
- `functions/` — 无服务器 API 适配层路由
- `ARCHITECTURE.md` — 模块级架构说明

## 环境要求

- Node.js 18 或更高版本

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:3000`。

如果只是普通本地运行，不需要 watch 模式：

```bash
npm start
```

## HTTP 接口

- `GET /healthz` — 健康检查
- `/api/zhibo/*` — 代理到新浪 7x24 接口
- `GET /api/avatar?url=...` — 白名单头像代理
- `POST /api/discord-webhook` — Discord Webhook 转发 / 更新代理

## 补充说明

- 本地开发时，仓库根目录会被直接作为静态站点根目录提供。
- Discord 功能是可选模块，可以单独移除。
- 更详细的模块拆分说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
