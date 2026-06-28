# README 维护参考

随代码变更自动保持 README 文件同步更新的检测逻辑与模板。

---

## 触发时机

- ✅ 新增功能
- ✅ 项目结构变更
- ✅ 依赖新增或移除
- ✅ 安装或配置说明变更
- ✅ 用户提到 README 或文档
- ✅ 配置文件被修改

---

## 更新范围

### README 章节对应关系

**Installation（安装）：**
- 新增依赖
- 安装步骤
- 前置依赖
- 环境变量

**Features（功能特性）：**
- 新增能力
- 功能变更
- 功能废弃

**Usage（使用说明）：**
- API 变更
- 新增示例
- 截图更新

**Configuration（配置）：**
- 新增选项
- 环境变量
- 配置文件变更

---

## 检测逻辑

### 变更分析

自动检测以下变更：
- **package.json** → 更新依赖章节
- **新增路由** → 更新 API 文档
- **.env.example** → 更新环境变量说明
- **docker-compose.yml** → 更新安装说明
- **新增功能文件** → 更新功能特性列表

### 章节映射

```yaml
代码变更 → README 章节：
  - 新增 API 端点 → Usage / API 参考
  - 新增依赖 → Installation
  - 新增环境变量 → Configuration
  - 新增功能 → Features 列表
  - 架构变更 → Architecture 章节
```

---

## 更新示例

### 新增功能

```bash
# 新增了认证功能：
git diff
# + auth.service.ts
# + login.component.tsx
# + JWT 中间件

# 建议 README 更新：
## 功能特性
- ✨ 基于 JWT 的用户认证  # 新增
- 🔐 基于角色的访问控制  # 新增
- 用户管理
- 控制台
```

### 新增依赖

```bash
# 执行了：npm install stripe

# 建议更新：
## Installation

```bash
npm install
# stripe 用于支付处理，已包含在 package.json 中
```

## 环境变量
```bash
STRIPE_SECRET_KEY=your_stripe_key  # 支付功能必填
```
```

### 安装说明变更

```bash
# 修改了 docker-compose.yml

# 更新 README：
## 开发环境搭建

```bash
# 1. 克隆仓库
git clone [url]

# 2. 安装依赖
npm install

# 3. 启动服务（已更新）
docker-compose up -d  # 现在包含 Redis 缓存

# 4. 执行迁移
npm run migrate
```
```

---

## 智能更新原则

### 保留原有结构

- 保留 emoji 风格
- 保持格式一致
- 维持语气和语调
- 尊重现有组织结构

### 补充缺失章节

```markdown
# 建议补充：

## 前置依赖
- Node.js 18+
- Docker（用于开发环境）
- PostgreSQL 14+

## 环境变量
```bash
DATABASE_URL=postgresql://localhost/mydb
API_KEY=your_api_key
```

## 测试
```bash
npm test
```
```

### 更新示例代码

```markdown
# 之前：
```javascript
const result = api.getUsers();
```

# API 变更后：
```javascript
const result = await api.getUsers({ page: 1, limit: 10 });
```
```

---

## 版本兼容性追踪

```markdown
## 环境要求

- Node.js 18+（从 16+ 升级）
- TypeScript 5.0+（新增要求）
- React 18+（未变更）
```

---

## 与 CHANGELOG 的联动

README 可同步 CHANGELOG 顶部摘要：

```markdown
## 近期变更

详细版本历史见 [CHANGELOG.md](CHANGELOG.md)。

### 最新版本（v2.1.0）
- ✨ 新增用户认证
- 🔧 修复数据处理内存泄漏
- 📝 更新 API 文档
```

---

## README 模板

### 基础结构

```markdown
# 项目名称

简短描述

## 功能特性
- 特性 1
- 特性 2

## Installation

```bash
npm install
```

## Usage

```javascript
// 示例
```

## Configuration
所需环境变量

## Contributing
如何贡献

## License
MIT
```

### 完整结构

```markdown
# 项目名称
> 一句话描述

[徽标]

## 目录
- 功能特性
- 安装
- 使用说明
- API 参考
- 配置
- 开发
- 测试
- 部署
- 贡献指南
- 许可证

[各章节详细内容]
```

---

## 最佳实践

1. **保持实时更新** — 每次新增功能时更新 README
2. **具体明确** — 包含版本号、前置依赖
3. **提供示例** — 展示实际用法，而非仅罗列 API
4. **包含 Troubleshooting** — 常见问题及解决方案
5. **徽标状态** — 保持构建/覆盖率徽标为最新

---

## 与其他工具的协作

### 与 CI/CD 集成

```yaml
# .github/workflows/docs.yml
- name: 检查 README 同步状态
  run: |
    # 基于变更内容提示 README 更新
    # 审查后提交
```

### 自定义公司规范

```bash
# 复制并定制为公司版本
cp -r .claude/skills/readme-updater \
      .claude/skills/company-readme-updater

# 编辑添加：
# - 公司 README 模板
# - 必填章节
# - 徽标规范
```
