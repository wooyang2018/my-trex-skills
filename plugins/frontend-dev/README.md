# frontend-dev

前端开发插件，整合了 Vercel 官方 React/Next.js 技能集、微软 Playwright CLI、shadcn/ui 用法与 Anthropic 官方前端视觉设计指导，覆盖从组件开发、浏览器调试到视觉打磨的完整前端工作流。

## 依赖

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills   # 生成 playwright-cli skill 文件
```

## Skills

| Skill | 来源 | 说明 |
|-------|------|------|
| `react-best-practices` | vercel-labs/agent-skills | React/Next.js 性能规范，8 大类 70 条规则 |
| `react-view-transitions` | vercel-labs/agent-skills | React `<ViewTransition>` API、CSS 方案、Next.js 集成 |
| `composition-patterns` | vercel-labs/agent-skills | 复合组件、Context 模式、React 19 API |
| `web-design-guidelines` | vercel-labs/agent-skills | 运行时从 vercel-labs/web-interface-guidelines 拉取规则 |
| `react-native` | vercel-labs/agent-skills | React Native & Expo 最佳实践，35+ 条规则 |
| `playwright-cli` | @playwright/cli（微软） | 浏览器调试循环：控制台、网络、截图、JS 执行 |
| `shadcn` | openai/plugins（build-web-apps）| shadcn/ui CLI、组件组合、表单、样式、图标规则 |
| `frontend-design` | anthropics/claude-code（Anthropic 官方）+ VoltAgent | 前端视觉设计：摆脱 AI 千篇一律的审美，编码时给出字体、配色、动效、空间构图的方向；并附 73 套知名品牌设计范本（`references/`）|

## Playwright CLI 核心命令

```bash
playwright-cli console     # 读取浏览器控制台错误/警告
playwright-cli requests    # 检查网络请求与失败
playwright-cli screenshot  # 视觉截图验证
playwright-cli snapshot    # DOM 快照
playwright-cli eval        # 在页面上下文中执行 JS
```

## 维护说明

- **Vercel skills**：可直接编辑 SKILL.md，保留 `author: vercel` 元数据
- **playwright-cli skill**：不手动编辑，重新运行 `playwright-cli install --skills` 更新
- **shadcn skill**：从上游 openai/plugins 的 `build-web-apps/skills/shadcn-best-practices` 静态拷贝，上游更新时手动同步
- **frontend-design skill**：源自 Anthropic 官方 anthropics/claude-code，`SKILL.md` 已译成中文并在尾部追加范本库指引（不再与上游逐字对应，更新时人工重译），署名与许可见同目录 `LICENSE.txt`（Anthropic 商业条款）。范本库 `references/design-md/`（73 份）来自 VoltAgent/awesome-design-md（MIT，见 `references/LICENSE` 与 `references/ATTRIBUTION.md`），同步办法见 `ATTRIBUTION.md`
