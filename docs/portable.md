# 单文件双击体验

项目根目录 `index.html` 是自包含的 MemoryBox 成品。下载后用当前 Chrome 或 Edge 双击打开，无需 Node、Python、服务器、API Key、浏览器启动参数或网络。

首次进入时可运行机械八音盒开场与穿越，五房间老屋、独立火车站及车厢、独立教室及走廊，人物选择、三件物品叙事、两条分支、写信、返回现实和浏览器本地收藏。`file://` 使用明确标注的本地演示模式，隐藏数据库同步入口；后端数据库同步仍需按 README 启动 HTTP 前后端。

## 构建

```powershell
cd 'G:\memorybox codex\frontend'
npm install
npm run typecheck
node scripts/build-portable.mjs
```

构建器使用 `vite.portable.config.ts`，把 React、Three.js 和应用代码打包成一个 IIFE，CSS 直接嵌入 HTML。动态模块被合并，不依赖 CDN、外部字体、远程 decoder 或额外脚本。

根目录 `THIRD_PARTY_LICENSES.txt` 中的运行依赖版权和许可全文也内嵌到 HTML 的隐藏许可区；单独分发 HTML 时保留。依赖变更后，在 `frontend` 执行 `node scripts/collect-runtime-licenses.mjs` 更新许可清单再打包。

打包白名单仅包含运行所需的八个站立/坐姿 GLB、十张房间 PBR 贴图、一张虚构合影、四张皮肤、`character-materials.json` 列出的衣物/发型/五官贴图、1K HDR照明和两份自包含精细家具GLB。原始 OBJ、targets、MHCLO、生成脚本、截图、日志、数据库、用户收藏、tokens 和 node_modules 不会嵌入。

`setupPortableAssets()` 在 React 挂载前设置 Three.js `DefaultLoadingManager` URL 映射，将 `/assets/...` 解析为 HTML 内嵌 data URI。普通 HTTP 开发没有内嵌映射时沿用原资产路径。GLB 在构建时会检查文件完整性、外部资源引用和外置解码器依赖，缺少资源会直接构建失败。

临时 JavaScript/CSS 在打包后清理，只有小型构建记录保留在 `frontend/.portable-build/portable-build-report.json`；记录包括所有素材字节数和 SHA-256。根目录 `index.html` 可作为 GitHub Release 下载项或放入源码仓库供下载。

## 数据与浏览器限制

- 信件只在当前浏览器对当前本地文件的存储范围内保存，不写进下载文件。
- 移动 HTML、换浏览器或清理浏览器数据，可能使原本地收藏不再可见；个人内容不会上传。
- 需要支持 WebGL 的现代 Chrome/Edge。若浏览器禁用硬件加速，界面会提供实际错误提示，不能把纯软件渲染速度当作显卡帧率。
- `file://` 的本地存储行为由浏览器决定；若被限制，应保留可玩的当前会话并明确提示无法持久保存。
