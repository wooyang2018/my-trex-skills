# 范本库来源与许可

`design-md/` 下的 73 份 `DESIGN.md` 收录自 VoltAgent/awesome-design-md，原样保留，仅剔除每个品牌目录里那个指向官网的 `README.md` 占位文件。

- **来源**：https://github.com/VoltAgent/awesome-design-md
- **许可**：MIT（全文见同目录 `LICENSE`）
- **免责声明**（沿用上游）：这些 `DESIGN.md` 记录的是各站点**公开可见的 CSS 取值**，按"原样"提供、不含任何担保；不主张拥有任何品牌的视觉标识，相关商标归各自所有者。

这部分走 MIT，与本仓库的 MIT 兼容——区别于 `frontend-design` 主体（Anthropic 商业条款，见上一级 `LICENSE.txt`）。

`INDEX.md` 由本仓库依据上游 README 的分类与一句话描述生成，便于按品牌检索；上游 README 漏列的 `slack` 已补入"其他"分组。

## 同步上游

```bash
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git /tmp/awesome-design-md
# 拷贝各品牌 DESIGN.md（剔除每品牌 README 占位），覆盖 design-md/
# 重新生成 INDEX.md（解析上游 README 的 Collection 分类 + 一句话描述）
# 核对 LICENSE 与本 ATTRIBUTION
```
