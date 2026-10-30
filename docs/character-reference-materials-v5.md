# v5 人物参考图与三维材质

本次先通过 OpenAI 内置 image_gen 生成并查看四位虚构成年人物的多视角参考图，再修改三维几何与材质。原始 PNG 和实际提示词记录在 [generation-manifest.json](character-references/v5/generation-manifest.json)。这些参考图未经过用户逐张确认，不将它们称为已批准设定。

## 实际流水线与边界

1. 每位角色先生成正面、侧面、背面、四分之三视图，以及正面/侧面脸部特写；读取实际 PNG 像素，使用坐标网格逐图检查眼、鼻、唇、下巴和额头锚点。
2. 读取 MakeHuman CC0 hm08 身体、各角色 target 和 MHCLO 服装代理的原始逐角 UV，保留 UV 接缝。以 CPU 三角形栅格化得到 UV 像素对应的三维表面坐标。
3. 面部使用眼距横向比例与五官高度分段插值对齐参考正脸。照片只在鼻颊、下颌和唇部可信区域融合；一般区域最高权重约 0.48，唇部另作局部掩膜，最高权重约 0.75。原始皮肤继续负责环绕头部、后脑、耳、身体及眉眼/发际遮挡处，按参考肤色进行低权重色度匹配。侧脸照片仅参与局部肤色统计，未声称已经完成侧面相机标定投射。
4. 掩膜排除背景、眉眼、头发及眼镜框；初次直接投射出现的额头色块与眉毛/发际误投射已在 CPU 预览中发现并去除。保留独立棕色眼球、眉片、睫毛、发片和几何眼镜，不将一整张照片覆盖到头部。
5. 服装从参考图提取无大范围光照的细纤维变化，并离线构造原创针织、细格棉布与斜纹细节/法线。上衣与裤裙按连通表面分类，连体青年男资产补充已知 UV 岛约束；保留其原有 CC0 牛仔裤缝线、口袋和磨损。旧红黑条纹不再用于这四套外衣。
6. 在真实 glTF 网格上绑定色图与切线法线，沿用 MeshStandardMaterial。皮肤 roughness=0.64、normalScale=0.18；外衣 roughness=0.89、normalScale=0.24；头发与新碎发 roughness=0.88。新白领/内搭和纽扣保留独立 reference: 材质。

这是参考图引导的既有三维模型材质烘焙与几何修整，不是图片自动重建、精确身份复原或多视角摄影测量。法线由局部亮度高频细节导出，并非测得的皮肤高度/法线。最终外形与遮挡仍由三维网格、绑定与光照决定；运行时不使用照片平面替代人物。

## 运行时资源

清单：[reference-materials-v5.json](../frontend/public/assets/models/reference-materials-v5.json)，结构为 version:5 和 assets 数组，包含 4 条皮肤与 4 条服装，共 16 张 WebP。皮肤色图 2048×2048，其余图均为 1024×1024。新贴图总计 **2,910,508 字节**，低于本次 5,000,000 字节目标；这不是整个单 HTML 的大小。原始设定图留在 docs，运行时仅使用清单中的 color/normal 文件。

| 资源 ID | glTF 材质 | 色图路径 | 色图字节 | 法线路径 | 法线字节 |
|---|---|---|---:|---|---:|
| elder-woman-skin | skin | /assets/models/reference-materials-v5/elder-woman-skin-color.webp | 480,450 | /assets/models/reference-materials-v5/elder-woman-skin-normal.webp | 244,420 |
| elder-woman-outfit | cc0:elder-shirt | /assets/models/reference-materials-v5/elder-woman-outfit-color.webp | 15,932 | /assets/models/reference-materials-v5/elder-woman-outfit-normal.webp | 139,034 |
| elder-man-skin | skin | /assets/models/reference-materials-v5/elder-man-skin-color.webp | 446,786 | /assets/models/reference-materials-v5/elder-man-skin-normal.webp | 258,474 |
| elder-man-outfit | cc0:male_casualsuit03 | /assets/models/reference-materials-v5/elder-man-outfit-color.webp | 80,936 | /assets/models/reference-materials-v5/elder-man-outfit-normal.webp | 133,342 |
| young-woman-skin | skin | /assets/models/reference-materials-v5/young-woman-skin-color.webp | 280,644 | /assets/models/reference-materials-v5/young-woman-skin-normal.webp | 121,882 |
| young-woman-outfit | cc0:female_elegantsuit01 | /assets/models/reference-materials-v5/young-woman-outfit-color.webp | 15,674 | /assets/models/reference-materials-v5/young-woman-outfit-normal.webp | 111,008 |
| young-man-skin | skin | /assets/models/reference-materials-v5/young-man-skin-color.webp | 296,826 | /assets/models/reference-materials-v5/young-man-skin-normal.webp | 173,730 |
| young-man-outfit | cc0:male_casualsuit01 | /assets/models/reference-materials-v5/young-man-outfit-color.webp | 43,534 | /assets/models/reference-materials-v5/young-man-outfit-normal.webp | 67,836 |

## 重建与验证

在仓库根目录运行（Python 需 Pillow 与 NumPy；本机验证为 Pillow 12.2、NumPy 2.5）：

```text
python frontend/public/assets/models/prepare-reference-materials-v5.py
```

需要 CPU UV/面部诊断图时追加 --previews。默认只重建运行时 WebP 与清单；本轮可安全重建的坐标网格、CPU 预览、临时脚本和自身 Python 缓存均已清理。原始 source 皮肤、参考 PNG 与几何文件未被本材质脚本覆盖。

[validation.json](../frontend/public/assets/models/reference-materials-v5/validation.json) 记录实际文件解码、尺寸、哈希、像素统计和预算检查：16 张非空 WebP 全部通过，normal 蓝通道均值均大于 235；身体 UV 覆盖约 261 万像素，服装 UV 覆盖均大于 37.5 万像素。绑定代码经 npm run typecheck 通过，Python 源码语法 compile 通过。独立眼球/眉片材质路径通过代码人工检查保留。

CPU 面部预览用于发现 UV/照片映射错误；它未加载独立眼球和发片，不能作为完整人物品质图。最终四角色正侧背近景、运动与内搭穿透等验收由实际场景渲染复核，不能用本清单或面数替代。

## 预算与缓存边界

16 张新图若按 RGBA8 解码约占 **112 MiB**，完整 mip 链估算约 **149.3 MiB**；这些是尺寸推算，不是 GPU 实测，且不包含旧眼睛/头发/鞋材质、场景或其他渲染资源。WebP 减少传输/单文件体积，不等同于 BC7/ASTC 的 GPU 压缩纹理。当前以 Windows 桌面 WebGL 品质为目标，未做真实移动设备帧率或显存承诺。

Characters.tsx 的 sharedTexture 按 URL 缓存 Promise/Texture，因此同一页面内相同角色/多实例共享贴图；每个角色实例仍有独立材质参数和骨骼。该缓存不跨页面或浏览器标签页，也未实现长期淘汰。世界贴图沿用 Three.js 默认 mipmap，anisotropy=4；本材质变更本身不新增 draw call，几何变化的 draw call 需独立统计。

运行时只需要本地 glTF、色图和法线，没有图像生成 API、网络或 API key 依赖。

## 首轮实际渲染的材质协查

首轮 geometry-portrait-elder-woman.png 与 geometry-wave.png 出现白领碎三角和侧腰/下摆黑口，不能记为最终 GPU 通过。材质协查保留 [uv-artifact-audit.json](../frontend/public/assets/models/reference-materials-v5/uv-artifact-audit.json) 与 [uv-mip-audit.json](../frontend/public/assets/models/reference-materials-v5/uv-mip-audit.json)：

- 两女性外衣色图没有白色像素；白领仍是独立、未贴图的 reference:ivory-knit，因此碎白三角不来自外衣色图。
- 最终 glTF UV 均为有限值。老年女性原上衣有 3,088 个三角面、裤片 1,712 个；最终 1,712 个深色采样面对应裤片，最高位置约 y=0.975 米。青年女性深色采样同样延伸到裙腰 UV。此证据提示优先检查腰部裤裙与外衫的表面相交、遮挡或间隙。
- 色图未覆盖区使用上衣底色，另有 6 像素岛边缘扩张，不是黑色空白。对每个上衣三角面取 7 点（含近顶点及边缘），在 CPU BOX 下采样的 mip0–4 图上近似双线性采样：老年女性每级 21,616 点、青年女性每级 24,248 点，均未出现平均 RGB 小于 80 的近黑样本。mip0 最暗约 130/123，mip4 最暗约 89/97。
- 6 像素扩张不能保证任意粗 mip 都没有岛间混色；当前检出的是较粗级别的轻微混色，无法解释截图中的近景大块黑口。没有为掩盖几何问题盲目重绘贴图。上述 CPU 采样不等于实际 WebGL LOD、三线性/各向异性采样或同镜头纯色渲染；最终仍需实际场景复验。
