# 单文件双击体验 · v0.4.0

`build:portable` 生成项目根目录自包含的 `index.html`。构建完成后可用当前 Chrome 或 Edge 双击打开，无需 Node、Python、服务器、API Key、浏览器启动参数或网络。当前源码版本为 0.4.0；本轮单文件重建、离线回归与发布状态待 [验证记录](verification.md) 确认，不能仅凭源码版本判断现有 HTML 已包含全部修改。

源码中的离线流程覆盖珠贝胡桃木八音盒、水晶玫瑰与花瓣门穿越，五房间老屋、独立火车站及车厢、独立教室及走廊；提供第一 / 第三人称与总览、分别选择自身形象和陪伴角色、三件物品、两条分支、写信、返回现实和本地收藏。动态场景使用共享故事时钟播放、暂停与重播；电视是原创 Canvas 动画，列车门、信号、车轮和位移由本地程序计算。`file://` 使用明确标注的本地演示模式，隐藏数据库同步入口；后端数据库同步仍需按 README 启动 HTTP 前后端。

## 构建

```powershell
cd 'G:\memorybox codex\frontend'
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build:portable
```

构建器使用 `vite.portable.config.ts`，把 React、Three.js 和应用代码打包成一个 IIFE，CSS 直接嵌入 HTML。动态模块被合并，不依赖 CDN、外部字体、远程 decoder 或额外脚本。

根目录 `THIRD_PARTY_LICENSES.txt` 中的运行依赖版权和许可全文也内嵌到 HTML 的隐藏许可区；单独分发 HTML 时保留。依赖变更后，在 `frontend` 执行 `node scripts/collect-runtime-licenses.mjs` 更新许可清单再打包。

打包白名单包含八个站立 / 坐姿人物 GLB、十张房间 PBR、虚构合影、`character-materials.json` 中的旧衣物 / 发型 / 五官图、`reference-materials-v5.json` 中八条皮肤 / 服装资源的 16 张色图和法线、1K HDR 以及两份自包含家具 GLB。旧 `skins/` 路径的四张皮肤仅在运行代码仍引用时加入。人物参考的完整 PNG / 提示词留在 docs，不作为运行时平面人物嵌入。原始 OBJ、targets、MHCLO、生成脚本、截图、日志、数据库、收藏、tokens 和 node_modules 不会嵌入。

`setupPortableAssets()` 在 React 挂载前设置 Three.js `DefaultLoadingManager` URL 映射，将 `/assets/...` 解析为 HTML 内嵌 data URI。普通 HTTP 开发没有内嵌映射时沿用原资产路径。GLB 在构建时会检查文件完整性、外部资源引用和外置解码器依赖，缺少资源会直接构建失败。

临时 JavaScript/CSS 在打包后清理，只有小型构建记录保留在 `frontend/.portable-build/portable-build-report.json`；记录包括所有素材字节数和 SHA-256。根目录 `index.html` 可作为 GitHub Release 下载项或放入源码仓库供下载。

当前 [v0.4 构建记录](portable-build-v0.4.0.json) 为 62 项内嵌资源、53,276,297 字节，SHA-256 `885c3b10012a13f901d21c0f0fe43c373b916021981d0a45f81c414d6b97d686`。公开下载与匿名核验见 [验证记录](verification.md)。

## 数据与浏览器限制

- 信件只在当前浏览器对当前本地文件的存储范围内保存，不写进下载文件。
- 移动 HTML、换浏览器或清理浏览器数据，可能使原本地收藏不再可见；个人内容不会上传。
- 自身形象、陪伴角色与视角偏好分别保存；这些选择不写进 HTML，也不改变讲述中人物的真实身份。
- 需要支持 WebGL 的现代 Chrome/Edge。若浏览器禁用硬件加速，界面会提供实际错误提示，不能把纯软件渲染速度当作显卡帧率。
- `file://` 的本地存储行为由浏览器决定；若被限制，应保留可玩的当前会话并明确提示无法持久保存。
- 人物为 21 骨骼程序蒙皮与步态，没有动作捕捉、手指 / 面部骨骼或布料物理。完整衣物遮挡、剧情暂停 / 重播及两种漫游视角须在最终 HTML 验证；桌面尺寸模拟不等于真实手机、iPad 或 Safari 验证。
