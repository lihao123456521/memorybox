# 素材与软件来源

当前源码版本为 0.4.0。本文说明实际素材来源与处理方式，不代表本轮视觉验收或发布已完成。项目不使用 Lux3D，不包含真实人物的私照或未经授权的身份复刻。

## 三维资产与纹理

- 珠贝胡桃木八音盒、绒布托盘、旋转水晶玫瑰、花瓣时空门、主体房间、车站 / 列车、教室及大部分家具：本项目 Three.js 源代码生成；曲线镜头、程序场景动作和生成方法保留在源码中，不是下载的商业模型或机械仿真结果。
- 人体、衣着、发型、眼球、眉睫与鞋：MakeHuman Community CC0 图形资产，由本项目独立转换程序按四类体形拟合；原图形许可见 `docs/character-assets-v3.md`，本轮拟合、蒙皮和实际模型见 `docs/character-assets-v4.md`。没有复用上游应用程序代码。
- 角色原始皮肤：来源、原始材质许可证和下载记录见 `docs/character-assets.md`；旧衣物 / 发型 / 五官纹理见 `frontend/public/assets/models/character-materials.json`。v0.4 新材质以原 CC0 皮肤与原 UV 为基础，融合生成参考图的可信局部肤色 / 细节，并使用原创针织、细格和斜纹纹理；16 张色图 / 法线见 `frontend/public/assets/models/reference-materials-v5.json`。
- 四套多视角人物参考：OpenAI 内置 `image_gen` 为本项目生成的虚构成年人物图像，先生成并查看，再用于参数拟合、局部几何调整与 UV 烘焙。完整 PNG 与实际提示词在 `docs/character-references/v5/generation-manifest.json`，实际流程和局限见 `docs/character-reference-materials-v5.md`。它们不是上游 MakeHuman 原始 CC0 素材，也不表示自动图片重建或真实身份复原；完整设定图不作为运行时平面人物显示。
- 人物运行时 21 骨骼层级、几何驱动权重、程序步态 / 挥手 / 谈话和故事路径：本项目实现，继续作用于原连续网格；没有引入第三方动作捕捉片段、真实人物表演录像或收费角色生成服务。
- 精细电视和中式扶手椅：Poly Haven `television_02`、`chinese_armchair`，CC0，纹理已内嵌在本地GLB，见 `docs/cc0-props-v3.md`。
- 室内 HDR 环境光：Poly Haven [Lebombo](https://polyhaven.com/a/lebombo)，Greg Zaal，CC0；使用1K HDR采样照明与反射，不显示为房间背景。
- 木地板、墙面、织物 PBR：Poly Haven CC0 资源。下载链接、文件大小和哈希见 `docs/room-assets.md`、`frontend/public/assets/textures/sources.json`。官方许可：[Poly Haven License](https://polyhaven.com/license)。
- 相框合影：内置 image_gen 为本项目生成的虚构人物图像，仅作为三维相框的二维纹理。提示词见 `docs/image-generation.md`。
- 电视节目：本项目 `LocalTelevision.tsx` 在离线 Canvas 上绘制的原创动画，再绑定到电视屏幕；不是第三方影视节目、用户上传视频或历史录像。列车门、轮转、信号与位移是源码计算的三维动作。
- 环境和交互声音：本项目 Web Audio 合成，无第三方音频采样。

## 软件

React、Three.js、React Three Fiber、Drei、Lucide 及其运行依赖的版权和许可全文保存在根目录 `THIRD_PARTY_LICENSES.txt`，构建器会将同一份文本内嵌到离线单文件的隐藏许可区，单独复制 `index.html` 时也保留。收集脚本为 `frontend/scripts/collect-runtime-licenses.mjs`。

Vite、FastAPI、Pydantic、Uvicorn、pytest 和 Playwright 按各自发行包中的许可证使用。确切依赖版本以 `frontend/package-lock.json` 与 `backend/requirements-lock.txt` 为准。

具体资产记录与当前实际运行资产清单见 `frontend/public/assets/manifest.json`。没有有效文件的未来供应商任务不应记为已生成资产。

最终单文件的内嵌资产、版本与哈希应以实际构建记录核对，发布与验证状态见 `docs/verification.md`。发布与匿名核验只按该验证记录中的实测结果判断。
