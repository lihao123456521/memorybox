# 素材与软件来源

本项目不使用 Lux3D，不包含真实人物的私照或未经授权的身份复刻。

## 三维资产与纹理

- 房间、家具、交互物件、衣着与发型：本项目源代码生成，生成方法保留在源码中。
- 人体基础拓扑与年龄/性别形态：MakeHuman Community 的 CC0 核心资产；确切文件、构建方法和许可证证据见 `docs/character-assets.md`。
- 角色皮肤：来源、原始材质许可证和下载记录见 `docs/character-assets.md`。
- 木地板、墙面、织物 PBR：Poly Haven CC0 资源。下载链接、文件大小和哈希见 `docs/room-assets.md`、`frontend/public/assets/textures/sources.json`。官方许可：[Poly Haven License](https://polyhaven.com/license)。
- 相框合影：内置 image_gen 为本项目生成的虚构人物图像，仅作为三维相框的二维纹理。提示词见 `docs/image-generation.md`。
- 环境和交互声音：本项目 Web Audio 合成，无第三方音频采样。

## 软件

React、Three.js、React Three Fiber、Drei、Vite、Lucide、FastAPI、Pydantic、Uvicorn、pytest 和 Playwright 按各自发行包中的许可证使用。确切依赖版本以 `frontend/package-lock.json` 与 `backend/requirements-lock.txt` 为准。离线单文件中保留构建工具生成的第三方许可证注释。

具体资产记录与当前实际运行资产清单见 `frontend/public/assets/manifest.json`。没有有效文件的未来供应商任务不应记为已生成资产。
