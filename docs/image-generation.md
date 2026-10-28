# 原创图片生成记录

- 工具：Codex 内置 `image_gen`，无需 API Key；未使用 Lux3D。
- 最终项目文件：`frontend/public/assets/images/family-photo.png`。
- 用途：Three.js 相框内的二维照片纹理。整个房间、相框与人物模型均为实际三维网格；该图片不充当房间背景。
- 人物：虚构的绘本人物，未使用用户或真实家庭照片。
- 已实际打开检查：构图为奶奶、孩子与红色布娃娃，家庭庭院暖色场景，无文字、水印或损坏；作为插画照片使用。
- 加载失败：回退为本地 Canvas 绘制的双人合影，仍可点击相框并完成剧情。

本次使用的完整提示词：

```text
Use case: illustration-story. Create a single nostalgic family photograph illustration to use as a small photo texture inside a real WebGL 3D wooden photo frame in the MemoryBox game. Landscape 3:2 composition. A grandmother with softly silver hair in a sage-green blouse and a small Chinese child with a red cloth doll, sitting outside a modest old Chinese family house, summer 2005. Warm faded film tones, soft hand-painted storybook gouache, cream paper grain, quiet candid smiles, leafy shadows, sunlit courtyard. The people are fictional stylized storybook characters, not real people. Full-bleed image with no border, no writing, no date stamp, no watermark. This is ONLY a photo texture; do not render a device, picture frame, game interface or a 3D room. Muted sage, red clay, warm ivory and honey sunlight.
```
