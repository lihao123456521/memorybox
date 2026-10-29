# 素材与软件来源

本项目不使用 Lux3D，不包含真实人物的私照或未经授权的身份复刻。

## 三维资产与纹理

- 八音盒机械、主体房间、车站/列车、教室及大部分家具：本项目源代码生成，生成方法保留在源码中。
- 人体、衣着、发型、眼球、眉睫与鞋：MakeHuman Community CC0 图形资产，由本项目独立转换程序按四类体形拟合；实际文件、UV与材质处理、许可证证据见 `docs/character-assets-v3.md`。没有复用上游应用程序代码。
- 角色皮肤：来源、原始材质许可证和下载记录见 `docs/character-assets.md`；衣物/发型运行纹理见 `frontend/public/assets/models/character-materials.json`。
- 精细电视和中式扶手椅：Poly Haven `television_02`、`chinese_armchair`，CC0，纹理已内嵌在本地GLB，见 `docs/cc0-props-v3.md`。
- 室内 HDR 环境光：Poly Haven [Lebombo](https://polyhaven.com/a/lebombo)，Greg Zaal，CC0；使用1K HDR采样照明与反射，不显示为房间背景。
- 木地板、墙面、织物 PBR：Poly Haven CC0 资源。下载链接、文件大小和哈希见 `docs/room-assets.md`、`frontend/public/assets/textures/sources.json`。官方许可：[Poly Haven License](https://polyhaven.com/license)。
- 相框合影：内置 image_gen 为本项目生成的虚构人物图像，仅作为三维相框的二维纹理。提示词见 `docs/image-generation.md`。
- 环境和交互声音：本项目 Web Audio 合成，无第三方音频采样。

## 软件

React、Three.js、React Three Fiber、Drei、Lucide 及其运行依赖的版权和许可全文保存在根目录 `THIRD_PARTY_LICENSES.txt`，构建器会将同一份文本内嵌到离线单文件的隐藏许可区，单独复制 `index.html` 时也保留。收集脚本为 `frontend/scripts/collect-runtime-licenses.mjs`。

Vite、FastAPI、Pydantic、Uvicorn、pytest 和 Playwright 按各自发行包中的许可证使用。确切依赖版本以 `frontend/package-lock.json` 与 `backend/requirements-lock.txt` 为准。

具体资产记录与当前实际运行资产清单见 `frontend/public/assets/manifest.json`。没有有效文件的未来供应商任务不应记为已生成资产。
