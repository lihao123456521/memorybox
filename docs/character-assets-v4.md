# 人物连续蒙皮与参考拟合

此文记录 v4 建立的连续蒙皮流水线，以及在其上完成的 v5 参考拟合资产。当前模型统计对应 `character-build-report.json` 的 `builtAt=2026-10-30T03:54:18.365Z`；[冻结清单](character-references/v5/frozen-model-inventory.json)记录八份 GLB 与构建器、骨骼实现、关节点文件的 SHA-256。本文验收范围为人物资产和动作。

## 图形来源与建模方法

四种角色沿用完整 MakeHuman Community CC0 基体、各自亚洲年龄/性别 `.target`，以及完整 MHCLO 衣物、头发、眼球、眉毛、睫毛和鞋。人物由连续人体与服装表面构成；加载时不再显示球体/胶囊拼接的替身。

原始图形资产在 `frontend/public/assets/models/source/system-cc0/`；[来源与逐文件哈希](../frontend/public/assets/models/source/system-cc0-provenance.json)记录官方 CC0 资产包、2026-10-28 获取时间及归档哈希。保留的 MHCLO/MHMAT 文件头含 2020 年 9 月发布为 CC0 的声明，[本地许可全文](../frontend/public/assets/models/source/LICENSE.ASSETS.md)随源码保留。OBJ/MHCLO 解析、重心贴合、参考参数拟合、蒙皮权重和步态代码由本项目独立编写，没有引入 MakeHuman 应用的 Python/插件代码。

v5 先生成并查看四张[全方位参考](character-references/v5/)，每张包括四个全身视角及正面/侧面脸部特写，再对现有完整网格手工设定参数：

| 角色 | 参考引导的几何与服装变化 |
|---|---|
| 青年男性 | 轻柔化下颌、鼻翼及嘴角，蓝色翻领外衫保留原表面并精确裁开前襟；增加曲面米白圆领内搭和少量真实碎发几何 |
| 长者男性 | 保留年长完整面部、灰发和独立细框眼镜；浅灰细格衬衣、深裤使用完整原 CC0 衣着几何 |
| 青年女性 | 原马尾与完整女性基体；粉色开衫前襟、原 CC0 白领、过膝 A 字裙；去除鞋资产的长袜口并恢复可见踝部皮肤 |
| 长者女性 | 银灰发型压短、收拢后脑尾部并抬开遮眼前发；原 CC0 白领、较宽松绿色针织外衫、深裤 |

脸部形变为毫米量级的脸颊/下颌/眼眶/鼻翼/嘴角调整，保留原面部 UV 对应关系。指端增加轻微静态弯曲。原衣物 UV 保留；开襟切边的新顶点从原三角形插值 UV、法线和原姿态坐标。白领按原资产完整 UV 岛拆出并赋米白材质，避免用几片覆盖面压在原领片上。服装覆盖区的人体面按 MHCLO 遮挡规则及新增内搭覆盖区域隐藏，避免皮肤穿衣。

这是一套参考引导的参数拟合与 UV 颜色融合，未执行标定多视图重建，也没有验证与参考人物的精确身份一致性。新参考材质的独立流程、尺寸和哈希见 [reference-materials-v5.json](../frontend/public/assets/models/reference-materials-v5.json)。

## 当前八份 GLB

| 文件 | 实际字节 | 三角面 | Mesh |
|---|---:|---:|---:|
| young-man.glb | 2,639,316 | 88,271 | 10 |
| young-man-seated.glb | 2,639,308 | 88,271 | 10 |
| elder-man.glb | 2,320,712 | 78,048 | 12 |
| elder-man-seated.glb | 2,320,728 | 78,048 | 12 |
| young-woman.glb | 2,572,284 | 84,745 | 11 |
| young-woman-seated.glb | 2,585,576 | 86,064 | 12 |
| elder-woman.glb | 2,472,328 | 80,614 | 15 |
| elder-woman-seated.glb | 2,472,328 | 80,614 | 15 |

合计 **20,022,580 字节**。这是四类角色的站姿/坐姿资产，尚未制作 LOD0–LOD3 链。三角面数和 Node 端准备耗时不能代替目标硬件的 GPU 帧率测试。

## 原姿态、绑定姿态与导出约定

角色正面为本地 `+Z`，单位为米。外层 `Character.position` 对应地面位置，路径位移和朝向由父层负责。

| 位置 | 字段 | 含义 |
|---|---|---|
| 构建器 BufferGeometry | `human_rest`，vec3 | 衣物尚未折臂/坐下前、已随参考体形拟合的连续原姿态坐标 |
| 实际 glTF primitive attribute | `_HUMAN_REST` | GLTFExporter 自动为自定义属性加 `_` 并转大写 |
| GLTFLoader 后的 geometry attribute | `_human_rest` | Loader 将未知语义转小写，CPU 检查直接断言此实际名称存在 |
| 模型根节点 extras | `humanRestJoints` | 与 `_HUMAN_REST` 同坐标系、同体形的 21 个原姿态关节点 |
| 模型根节点 extras | `humanBindJoints` | 同一关节点经最终 standing/seated pose 后的绑定坐标 |
| TypeScript 生成文件 | `HUMAN_JOINTS` | 构建器由上述八组绑定坐标自动写入 `HumanJoints.ts`，供源码检查和兼容读取 |

输入属性若误写成 `_human_rest`，当前 Exporter 会再次加前缀，实际得到 `__HUMAN_REST`；因此构建端使用无前缀 `human_rest`。加载后缺失原姿态坐标或关节点会报模型加载错误，避免退回已知不可靠的当前坐标分类。

运行时 `HumanRig.ts` 从原姿态坐标计算平滑权重，以绑定姿态创建 **21 骨骼、每顶点最多 4 个影响** 的 `SkinnedMesh`。骨骼包括骨盆、腰背、胸、颈、头，及两侧锁骨、上臂、前臂、手、大腿、小腿、踝、足端。身体、衣物、头发、鞋保持完整表面；发/眉/眼/眼镜随头部，鞋底随踝、袜口随小腿。裙装在中心平滑混合左右大腿影响，保留连续布料。

原姿态静态折臂也使用真实手臂关节链距离与高度约束；仅按横向距离判断会把加宽裙摆或裤腰错当成手臂。体形、服装或 pose 改动后，必须由主构建器一并重建 GLB、原姿态属性及关节点，不能手改一份关节快照后沿用旧 GLB。

## Character 接口与实例隔离

```ts
type HumanMotion = 'idle' | 'walk' | 'wave' | 'talk';
type HumanAnimation = { motion: HumanMotion; time: number; speed: number };

// 静态 props
motion?: HumanMotion;
animationTime?: number;                 // 秒
walkingSpeed?: number;                 // 米/秒
reducedMotion?: boolean;

// 共享故事时钟；可通过 ref 推进、暂停、重播，无需每帧 React setState
animationClock?: {
  current: { time: number; playing: boolean; revision: number }
};

// 玩家或动作控制器每帧写入
animation?: { current: HumanAnimation };
```

动作与速度优先读取 `animation.current`；时间优先级为 `animationClock.current.time`、`animation.current.time`、`animationTime`、渲染时钟。共享时钟暂停时保留实际骨骼帧；`revision` 改变时清除上一次动作混合。坐姿支持 idle/talk/wave，行走用于站姿。

walk 使用髋、膝、踝求解、支撑/摆动周期及对侧摆臂。减少动态模式保留行走关节运动，降低躯干和手臂附加摆动，避免移动中的人物站立滑行。wave 采用较低上臂和较大屈肘的招手，限制普通衣料腋下拉伸；动作没有替父层改变角色路径。

同 preset 的 GLTFLoader 资产、计算好的加权几何和纹理 Promise 缓存复用；每个实例重新创建骨骼、Skeleton 与材质参数，玩家和 NPC 可以同时独立动作。`glb-character-${preset}` 名称保持，供 `loaded-characters` 诊断读取。`model.userData.characterReady` 初始为 false，绑定纹理 Promise 全部 settled 后为 true；失败 URL 记录在 `characterTextureErrors`，不会无限阻塞就绪门控。加载占位为 null，真正模型错误显示“人物模型加载失败 / 请刷新后重试”。

## 复建与验证

在 `frontend` 工作目录执行：

```powershell
node public/assets/models/build-characters.mjs
npm run typecheck
node scripts/check-human-rig.mjs
```

主构建器仅使用已保留的本地图形源文件与 Three.js，输出八份 GLB、`character-build-report.json` 和同源 `HumanJoints.ts`。运行时继续使用现有八个 `/assets/models/*.glb` URL；新参考 WebP 由 `reference-materials-v5.json` 列出，单 HTML 打包应同时嵌入这些文件及其余眼/眉/发/鞋颜色图，无外部 API 或解码服务依赖。

CPU 检查实际读取八份 GLB，验证 21 骨骼、权重归一/范围、双实例骨骼与材质独立/几何共享、真实手部表面随挥手运动、减少动态模式膝角仍变化、骨骼矩阵有限值。四站姿各测 normal/reduce × 3 个速度 × 24 个时刻，共 576 个脚底采样时刻；当前支撑脚最低点约在地面以上 0–2.6 毫米，低抬臂招手的手部表面抬升约 0.407–0.552 米。

实际 Chromium/SwiftShader 预览已逐张检查以下图，页面无 pageerror、无纹理失败 URL。该环境属于软件 WebGL 验证：

- [四人正面](screenshots/characters.png)、[侧面](screenshots/characters-side.png)、[背面](screenshots/characters-back.png)、[最终招手](screenshots/characters-wave.png)。
- [青年男性近景](screenshots/character-young-man.png)、[长者男性近景](screenshots/character-elder-man.png)、[青年女性近景](screenshots/character-young-woman.png)、[长者女性近景](screenshots/character-elder-woman.png)。
- [实际迈步](screenshots/characters-walk.png)。迈步 B、短发后脑、clay 表面诊断的本机原图保存在 `artifacts/characters-v5/`，不随公开仓库分发。

失败证据保留在本机 `artifacts/characters-v4/wave-failed-stretched-sleeve.png` 与 `artifacts/characters-v5/geometry-failed-*`，用于对照修复；不随公开仓库分发，也不是当前资产效果。

当前动作是程序步态与骨骼表演，未做动捕、独立手指动画、口型同步、布料动力学或标定人体身份重建。头发轮廓、发片细节及服装松量与参考仍有差异；近景通过上述检查不等于摄影级质量或硬件性能验收。
