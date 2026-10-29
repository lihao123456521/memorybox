# 两项 CC0 精细室内模型

采集与核验日期：2026-10-29。

## 运行资产

| 对象 | 运行文件 | 大小 | 三角面 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| 复古 CRT 电视 | `frontend/public/assets/props/television_02-1k.glb` | 1,238,988 B | 2,310 | `3a9fbae7ccc5f33e17c54c8d3e93ffc001379a5d44621ee81b6fa699d7fa1b23` |
| 中式木扶手椅 | `frontend/public/assets/props/chinese_armchair-1k.glb` | 1,702,316 B | 2,675 | `27ba0fc0b9f934597b399ca1a01c91ab8cd3dfcb951d7b4c2bfe90a70a348699` |

两 GLB 合计 **2,941,304 B（2.94 MB / 2.81 MiB）**，每项各含 diffuse、OpenGL normal、ARM 三张 1K JPG，保留基础色、法线、粗糙度、金属度，并将 ARM 红通道接入 AO。文件没有外部 URI，没有 Draco / Meshopt 压缩或解码依赖。没有新增 npm 依赖。

## 来源、许可、可复现处理

- 电视：[Poly Haven Television 02](https://polyhaven.com/a/television_02)，作者 Benny Weimer，下载清单 API：<https://api.polyhaven.com/files/television_02>。
- 椅子：[Poly Haven Chinese Armchair](https://polyhaven.com/a/chinese_armchair)，作者 Kirill Sannikov，下载清单 API：<https://api.polyhaven.com/files/chinese_armchair>。
- 官方许可：[Poly Haven Asset License](https://polyhaven.com/license)。官方明确所有模型为 CC0，允许商业用途、修改和再分发。许可网页留作本机核验材料，不随源码重复分发；公开仓库保留原始模型、API元数据、文件哈希与官方许可链接。
- 完整原始 glTF、BIN、三张 JPG 与官方 API 元数据保存在 `frontend/public/assets/props/source/television_02/`、`source/chinese_armchair/`。
- 每个原始下载文件的准确官方 URL、字节数、官方 MD5、实算 SHA-256，以及输出 GLB 的实算 SHA-256 均见 `frontend/public/assets/props/source/manifest.json`。所有下载文件均对照官方 MD5 与大小校验通过。
- 标准库转换脚本：`frontend/public/assets/props/source/build-props.mjs`。在仓库根目录执行 `node frontend/public/assets/props/source/build-props.mjs` 即可重建；已有正确原文件会直接复用。脚本合并 BIN，按四字节对齐内嵌 JPG，重写 bufferView offset 与 image.bufferView/mimeType。

## 场景集成

- `ScannedProps.tsx` 通过 `useGLTF` 加载并克隆场景，不改原 glTF 顶点、UV、法线或姿态。电视外层统一缩放 1.58，朝向客厅，底部世界高度 0.8025 m，与电视柜上表面吻合。原程序化 TV 的机壳、屏幕和天线几何已从 `Room.tsx` 删除。
- 电视锚点仍为 `[3.38,1.15,-2.15]`，沿用原 `Anchor` 的点击、悬停与高亮，原碰撞范围不变。扫描原件已包含凸面屏玻璃，为原 PBR 材质添加轻清漆并保留低强度青色屏光；没有叠放旧电视。
- 椅子只替换 `interior/Details.tsx` 中书房简易椅的那一段。位置 `[-6,.018,-5.38]`、绕 Y 轴 π、统一缩放 0.64，世界尺寸约 0.543 × 1.016 × 0.505 m；脚底高于地毯上表面约 2.5 mm，面朝书桌。书桌、书柜和通路布局不变。

## 验证

- `npm run typecheck`：通过（退出码 0）。
- `node public/assets/props/source/check-props.mjs`（工作目录 `frontend`）：使用本机 Playwright Chromium / SwiftShader 实际加载两 GLB、核对每项基础色/法线/粗糙度/AO 贴图，再挂载生产 `Room.tsx` 组件拍摄两个近景；浏览器 `pageerror` 为 0，两模型 HTTP 200。开发模式 HMR 的 WebSocket 被浏览器本地网络检查拦截，不影响 HTTP 模型加载和此次实际渲染。
- 实际 `Room` 电视中心鼠标射线点击回传 `tv`，记录见 `frontend/public/assets/props/evidence/render-report.json`。
- 已查看电视柜接触、凸屏、机壳细节，以及书房椅子的朝向、木纹、桌椅尺度与脚底。近景证据：`frontend/public/assets/props/evidence/room-tv-close.png`、`room-chair-close.png`。
- 本子任务没有覆盖单文件断网成品；打包器需内嵌上表两项 GLB，随后由集成验证检查。
