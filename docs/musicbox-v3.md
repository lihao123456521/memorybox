# 古典机械八音盒开场

本轮新增 `frontend/src/scenes/PresentScene.tsx` 和 `frontend/src/scenes/MusicBox.tsx`。前者默认导出接收 `SceneProps` 的完整 Canvas；主工程在现实世界分支引用它即可。没有修改故事、保存、房间控制或公共类型。

## 真实三维内容

- 中空胡桃木盒体、圆润多层压边、乌木饰条、黄铜角件、雕花脚座、锁孔与独立铰链。
- 盖面和正面的黄铜卷草、叶片与风玫瑰镶嵌均由三维曲线/网格构成。
- 独立转动的销钉圆筒；销钉使用 instanced mesh，44 根蓝钢梳齿、轴承/轴、螺钉和铭牌。
- 有真实轮齿及镂空孔的三只传动齿轮，交错旋向和相应齿数/速度；发条鼓、调速风叶与外侧钥匙。
- 盖内采用实时平面反射材质；机芯上方为带固定夹和螺钉的透明玻璃防尘盖。
- 回归时在盒沿显示红布纪念物、火漆信封及回忆卡，机芯仍保留。

这是交互叙事中的原创机械模型，不宣称为可制造的机械设计或精确声学仿真。声音仍由主应用控制。

## 状态与构图

- `landing`：盒盖合上，鼠标悬停仅轻微松动；真实网格点击调用 `onBox`，拖动不触发打开。
- 其他现实阶段：盖子平滑打开至约 81°；圆筒、传动齿轮和调速器缓慢转动。
- `transition-in`：盖子打开至约 94°，镜头推进机芯，增加低强度暖光；主应用负责后续穿越蒙版与世界切换。
- `collected`：显示收藏纪念物和信件。尊重 `reducedMotion`，降低动态时盖子直接到位、机械停止转动。
- 桌面构图将主体放在约 65% 的横向位置并为左侧文字留白；移动端以 Canvas 自身长宽比适配，物件居中，可配合主应用下半屏布局。

## 材质与运行依赖

木纹颜色/凹凸与铭牌文字由本地 Canvas 生成。木材、黄铜、钢、玻璃采用 Three.js PBR 材质；环境反射使用程序化 Lightformer，盖内镜面使用实时 MeshReflectorMaterial。没有远程 HDR、字体、纹理、模型、API Key 或 Lux3D 调用；没有新增必须打包的 public 资源。

## 验证与诊断

已在实际 Chromium / SwiftShader 中检查 1600×1000 闭盖、开盖、收藏和 390×500 物件视口。真实网格射线点击打开盒盖；最后一次渲染没有 `pageerror`，469 个 mesh，圆筒角度从 `-4.521` 变为 `-5.155`，确认不是静态模型。截图与 JSON 位于 `artifacts/musicbox-v3`，不是将截图用作应用中的场景。临时预览入口和渲染脚本已清理。

Canvas 保留 `data-world=present`、`data-camera-position`、`data-mesh-count`、`data-triangles`；新增 `data-scene-revision=mechanical-musicbox-v3`、`data-box-open`、`data-box-lid-angle`、`data-cylinder-angle`、`data-box-screen` 与 `data-mechanism`。可据此核对真实拾取、开盖及机构转动。

独立模块 TypeScript 检查通过。完整工程检查应在其他并行场景与公共类型集成后由主工程再次执行；本轮不把其他模块施工中的错误说成已通过。正常 GPU 帧率和物理移动设备尚未测量。
