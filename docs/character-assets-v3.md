# 四人物模型第三轮修正

本轮把前一版旋转面衣身、独立袖管、球形鞋与程序发帽替换为完整的 MakeHuman Community CC0 衣着、发型、眼球、眉毛、睫毛和鞋模型。原有青年男、长者男、青年女、长者女四种独立年龄/性别人体形态和亚洲皮肤来源保留。角色仍是虚构通用陪伴人物，不是对真人身份的复刻。

## 采用的原始资产

来源为 MakeHuman Community 官方的 [CC0 系统资产包](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)，原始下载文件为 [makehuman_system_assets_cc0.zip](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip)。本轮仅提取图形资产，没有把上游 Python 应用、下载器或插件逻辑带入项目。

| 角色 | 人体目标 | 衣着 | 发型 |
|---|---|---|---|
| 青年男性 | asian-male-young | male_casualsuit01，蓝色衬衣与牛仔裤 | short04 |
| 长者男性 | asian-male-old | male_casualsuit03，条纹长袖与长裤 | short02，银灰处理 |
| 青年女性 | asian-female-young | female_elegantsuit01，衬衫与裙装 | ponytail01 |
| 长者女性 | asian-female-old | male_casualsuit03 根据女性形态拟合，鼠尾草绿条纹处理 | braid01，银灰处理 |

共用 `shoes04` 鞋/袜、`eyes/high-poly` 眼球与 brown 虹膜、`eyebrow001`；女性角色增加 `eyelashes01`。全部原始 OBJ、MHCLO、MHMAT 和实际引用的纹理在 `frontend/public/assets/models/source/system-cc0/`。MHCLO/MHMAT 文件头逐项保留 **2020 年 9 月明确发布为 CC0** 的声明；完整 CC0 文本在既有 `source/LICENSE.ASSETS.md`。精确来源、字节数与 SHA-256 见 `source/system-cc0-provenance.json`。

## 建模与材质修正

- 独立编写 MHCLO 解析和重心坐标贴体算法，将原始衣物随四类体形变化；保留衣领、衣褶、裤腰、鞋型与衣物拓扑。
- 读取每个 OBJ 面角独立的 UV 索引，按实际纹理接缝拆分导出顶点；共享原始顶点的平滑法线，避免旧版只取首个 UV 导致贴图三角斑块。
- 头颈区域增加一次 Loop 细分平滑，缓和老年目标在下颌、面颊的明显多边形折线；法线在原始索引处共享后才复制给 UV 接缝顶点。
- 按服装的 `delete_verts` 遮挡信息移除被覆盖人体面，减少贴体穿插；衣着为完整独立网格。
- 发型采用带透明覆盖的实际发片与本地纹理，眼球改为完整 UV 虹膜并略微后收；棕虹膜去除偏红色调，保留眼白。长者眼镜增加细镜圈、鼻梁和镜腿。
- 站姿平滑调整手臂；坐姿保留大腿的体积和膝部折叠，不再把大腿表面压成单平面。年轻女性坐姿的裙装另补连续布料表面覆盖双腿，避免把直立窄裙直接折叠形成缺口。
- 本地 WebP 衣物颜色与法线贴图在运行时赋给 GLB 材质，皮肤原有 4 张 WebP 保留；没有 CDN 或额外解码器。

运行材质清单为 `frontend/public/assets/models/character-materials.json`，包含新增颜色/法线纹理的实际大小和哈希。单文件打包时应嵌入该清单中的 `color` 与 `normal` 资源；清单 JSON 本身不是运行时请求依赖。8 份 GLB 和四皮肤 URL 沿用原命名。

本次实际构建的 8 份 GLB 合计 15,312,776 字节；12 组衣服/发型/五官颜色与法线纹理共 24 张、1,800,700 字节。原有四张皮肤另计约 260KB。单个模型约 78,000–85,000 三角面，准确统计见 `character-build-report.json`。

## 复建与检查

```powershell
# 在 frontend 下执行；Pillow 仅在修改纹理时需要。
python public/assets/models/prepare-clothing.py
node public/assets/models/build-characters.mjs
node scripts/check-characters-v3.mjs
```

`build-characters-v2.mjs` 保留旧版生成方法供溯源；当前主构建器为 `build-characters.mjs`。独立可视检查脚本将四站姿、四坐姿及四张面部近景输出到本机 `artifacts/qa-v3/`，使用真实 GLB、皮肤与全部新材质。该预览要求开发服务在 5173 运行。

本版仍是站姿/坐姿资产与轻微呼吸，尚未加入完整骨骼表演、口型或真人扫描级重建。衣服与面部纹理的实质改善不能等同于已经达到摄影级质量。
