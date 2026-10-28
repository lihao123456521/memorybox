# 四类人物的真实来源和构建

当前包含青年男性、长者男性、青年女性、长者女性四类可选陪伴角色，每类有独立站姿和坐姿 GLB。它们是通用虚构人物，不是真实家人的身份复刻。

## 三维基础与衣着

- 基础拓扑：MakeHuman hm08，文件 `frontend/public/assets/models/makehuman-base.obj`。
- 四种形态：`source/asian-male-young.target`、`asian-male-old.target`、`asian-female-young.target`、`asian-female-old.target`。
- 官方许可证据：[MakeHuman License，资产章节](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)、[官方关于复用基础网格和皮肤的说明](https://www.makehumancommunity.org/mpfb/faq/build_other_chargen.html)。图形资产为 CC0；本项目没有复用 MakeHuman 的应用程序逻辑。
- 原始材质 `.mhmat` 文件头保留了 2020 年明确 CC0 声明，完整 CC0 文本见 `source/LICENSE.ASSETS.md`。
- 原创转换程序 `build-characters.mjs` 读取人体和形态数据，生成自然比例、完整衣着、眼球、眉毛、发型、长者眼镜、衣领、纽扣、鞋型等细节。
- 人体基础约 13,380 顶点、26,756 三角面；衣物与细节后每个角色约 47,000–52,000 三角面。站姿约 1.64–1.78 米，真实高度以 `character-build-report.json` 为准。衣身与长袖使用独立连续表面，避免人体三角面分色造成下摆和领口的锯齿残片；腰臀部分按各角色体形拟合以覆盖裤装。

## 皮肤纹理

四类人物使用对应 MakeHuman 系统皮肤，原始 `.mhmat` 与 PNG 保存在 `source/`，不依赖运行时网络地址。`prepare-skins.py` 把它们转换为 1K WebP，保留基础 OBJ 的 UV 坐标。

- 运行文件：`skins/young-man.webp`、`elder-man.webp`、`young-woman.webp`、`elder-woman.webp`。
- 原图及运行图 SHA-256、大小见 `skins/skin-build-report.json`。
- 合计约 260KB 的运行皮肤纹理，随单文件离线包一起嵌入。
- 贴图失败时仍呈现穿着完整衣服的角色；GLB失败时使用完整穿衣、自然成人比例的程序化替代人形。

## 复建

在 `frontend` 下：

```powershell
# 只在重新转换皮肤时需要 Pillow；运行和体验不需要 Python。
python -m pip install -r asset-requirements.txt
python public/assets/models/prepare-skins.py
node public/assets/models/build-characters.mjs
npm.cmd run build:portable
```

当前支持静态站姿/坐姿和轻微呼吸，未实现完整骨骼行走或嘴型表演。用户的室内行走由独立摄像机控制器完成，不依赖人物动画。
