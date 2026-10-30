# MemoryBox · 记忆盒子

让回忆有一个可以回去的地方。一段可行走的 3D 回忆之旅：机械八音盒 → 讲述记忆 → 开盖穿越 → 老屋 / 火车站 / 教室 → 真实 / 想象分支 → 写信 → 带着收藏回到现在。

当前源码版本为 **0.4.0**，加入第一 / 第三人称、独立的自身形象、可暂停重播的场景演绎与参考图引导人物拟合。人物近景、动态交互及单文件完整旅程已经实测；测试批次、下载校验和边界见 [验证记录](docs/verification.md)。

## 直接体验：双击 index.html

1. [下载 v0.4.0 离线包](https://github.com/lihao123456521/memorybox/releases/download/v0.4.0/MemoryBox-offline-v0.4.0.zip)，或在[公开仓库](https://github.com/lihao123456521/memorybox)选择 **Code → Download ZIP**。
2. 解压后，用 Chrome 或 Edge 打开根目录的 **`index.html`**。
3. 不需要安装 Node.js、Python、数据库或任何 API Key，也不需要启动本地服务。

经 `build:portable` 生成的根目录 `index.html` 是单文件离线交付物，内嵌代码、样式、GLB 人物与家具、PBR / 人物贴图、HDR 照明与合影。它可单独复制到其他文件夹或电脑，不依赖旁边的 `frontend` 文件夹。`frontend/index.html` 是开发入口。当前成品约 **50.8 MiB**，内嵌 **62 项资源**；文件哈希与资源清单见 [构建记录](docs/portable-build-v0.4.0.json)。

离线模式中的草稿、信件和人物选择保存在各自浏览器里。它们不会自动上传 GitHub，也不会随源码下载共享给别人。叙事使用明确标记的本地模板，不假称实时大模型生成。

以下为实际运行画面。八音盒、人物、主界面与场景演绎已更新；卧室和车厢空间细节沿用既有模型。

![机械八音盒开场](docs/screenshots/musicbox.png)

![MemoryBox 室内漫游](docs/screenshots/room.png)

![第三人称人物与房间](docs/screenshots/third-person.png)

![电视播放原创离线节目](docs/screenshots/television.png)

更多实测画面：[车站总览](docs/screenshots/station.png)、[卧室](docs/screenshots/bedroom.png)、[教室](docs/screenshots/classroom.png)、[四类人物](docs/screenshots/characters.png)、[人物侧面](docs/screenshots/characters-side.png)、[人物背面](docs/screenshots/characters-back.png)、[原始多视角参考](docs/character-references/v5/)。

## 场景与操作

- 开场为珠贝镶嵌胡桃木八音盒，含绒布内衬、可开合镜面盒盖、凹入式机芯观察窗、销钉圆筒、梳齿、齿轮与旋转水晶玫瑰；进入回忆时花瓣时空门展开，镜头沿曲线推进，再经加载遮罩进入所选空间。这是原创视觉演绎，不是机械加工仿真。
- 真实尺度的五个连通空间：客厅、厨房、阳台、卧室与书房。细化软垫缝线、床褥垂坠、窗帘褶皱、门窗五金、灯具与书脊；电视与中式扶手椅采用精细CC0模型。
- 独立火车站：候车大厅、站台与可步入的绿皮车厢；独立教室：课桌、黑板、纸条与阳光走廊，各自有三件不同剧情物品。
- 首次默认 **第一人称**：WASD / 方向键移动，鼠标或手指拖动环顾。无需 Pointer Lock。触屏也可以按住方向按钮移动；切换视角后保留当前浏览器的偏好。
- **第三人称** 显示独立的“我的形象”，镜头跟随行走并在墙体或家具前缩回。自身形象与陪伴角色分别选择、分别保存，不会互相替换；物品聚焦和剧情演绎会使用各自的镜头安排。
- 墙壁、家具与人物占位有碰撞限制，不能直接穿过茶几或墙。右下平面图显示当前所在区域。
- **房间总览** 可旋转观察，切回漫游保留之前的位置；点击旧电视、布娃娃和相框，依次发现三件不同的记忆。
- **切换人物** 分为“陪伴角色”和“我的形象”，均可选择青年男性、长者男性、青年女性、长者女性。先生成四套虚构人物的多视角参考，再对 MakeHuman CC0 人体 / 衣物做参数拟合、局部几何调整和原 UV 材质烘焙；这不是自动 AI 图片转 3D 或精确身份重建。见 [参考图到材质流程](docs/character-reference-materials-v5.md)。
- 人物以 **21 骨骼、每顶点最多四权重**驱动待机、程序步态、挥手与谈话动作。故事中的转身、沿通路行走和停步按时间轴演绎，可暂停、继续和重播；不把脚部轨迹计算称为动作捕捉、物理角色控制或完整表演系统。
- 旧电视播放原创离线 Canvas 动画节目；车站剧情按共享时钟协调滑门、信号、轮转与列车驶离。它们不是用户上传影像或真实历史录像；真实分支只有在已确认的选择对应离开时才触发离开动作。
- 三件物品解锁两种路线。想象分支持续标记 **AI 想象 · 并非真实历史**；写信后回到同一个现实木盒并查看收藏。
- 支持退出继续、刷新恢复、重玩保留收藏、删除、音效开关、大字和减少动态效果。

三种模板使用各自独立的三维空间。它们是承载讲述的艺术化场景，不表示对真实历史地点的精确重建。

## 一起修改

[团队开发说明](CONTRIBUTING.md) 包含 Fork / Pull Request、分支与成品更新方法。公开仓库允许所有人浏览和下载；没有写权限的队友可以在自己的 Fork 中修改并提交 Pull Request。

```powershell
git clone https://github.com/lihao123456521/memorybox.git
Set-Location memorybox
git switch -c feature/your-change
```

主要编辑位置：

| 内容 | 源码 |
|---|---|
| 故事流程、界面、人物设置 | `frontend/src/App.tsx` |
| 标准房间、家具与五个区域 | `frontend/src/scenes/Room.tsx`、`interior/Details.tsx` |
| 独立车站和教室 | `frontend/src/scenes/Station.tsx`、`Classroom.tsx` |
| 机械八音盒与开场 | `frontend/src/scenes/MusicBox.tsx`、`PresentScene.tsx` |
| 移动、镜头与碰撞 | `frontend/src/scenes/WalkController.tsx`、`navigation.ts` |
| 人物加载与可复建模型 | `frontend/src/scenes/Characters.tsx`、`frontend/public/assets/models/build-characters.mjs` |
| 21 骨骼动作、自身形象与跟随镜头 | `frontend/src/scenes/HumanRig.ts`、`WalkController.tsx` |
| 故事时钟、电视节目与列车动作 | `frontend/src/scenes/NarrativeClock.tsx`、`StoryActions.tsx`、`LocalTelevision.tsx`、`frontend/src/StoryPlayback.tsx` |
| 本地故事模板与状态恢复 | `frontend/src/data.ts`、`store.ts` |
| API、数据库与幂等保存 | `backend/app` |
| 单文件打包 | `frontend/scripts/build-portable.mjs` |

## 启动开发环境

以下仅供修改源码时使用。需要 Node.js 和 Python；本机开发使用 Node 24、Python 3.14。它们不属于离线浏览者的运行依赖。

Windows 在项目根目录一键启动前后端：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-memorybox.ps1
```

前端：[http://127.0.0.1:5173](http://127.0.0.1:5173)；后端健康检查：[http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)。服务仅绑定本机地址，日志位于忽略提交的 `artifacts/runtime`。

也可分别启动：

```powershell
# 终端一，在项目根目录
Set-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
# 终端二，在项目根目录
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

HTTP 开发版后端可用时把回忆和信件保存到本机 SQLite，并以当前浏览器随机凭据隔离；断线可离线体验，恢复后手动同步。文件协议离线成品始终使用浏览器存储，不连接 localhost。

## 验证与重新生成离线成品

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:portable
npm.cmd run test:e2e
```

`build:portable` 更新根目录 `index.html`。浏览器测试复用已有 Chromium / Edge；可设置 `MEMORYBOX_BROWSER` 为浏览器完整路径。完整 HTTP 测试需要开发服务；离线测试会把唯一的 HTML 复制到空文件夹，在阻断 HTTP 的全新浏览器中打开。

后端测试：在 `backend` 运行 `.\.venv\Scripts\python.exe -m pytest -q`。GitHub Actions 自动检查类型、普通构建、离线打包和后端接口测试。

实测结果和限制见 [验证记录](docs/verification.md)。桌面浏览器的手机尺寸检查不代表实体手机、iPad 或 Safari 验证；未测量实际 GPU 帧率。

## 资源与边界

主要建筑、八音盒结构、场景动作与电视节目为原创程序实现；精细家具、PBR 与 HDR 来自 Poly Haven CC0，人物基础来自 MakeHuman CC0 图形资产，拟合、蒙皮权重与转换逻辑由本项目实现。虚构合影与四套多视角人物参考由内置 image_gen 生成：合影用于相框，人物参考用于建模与局部材质烘焙，完整参考 PNG 不作为运行时三维人物平面。来源与许可见 [素材说明](THIRD_PARTY_NOTICES.md)、[人物参考与材质](docs/character-reference-materials-v5.md)、[房间升级](docs/interiors-v3.md)。

人物已加入连续网格的运行时骨骼驱动；现有站姿 / 坐姿资产与程序动作仍有边界：没有手指 / 面部表情骨骼、口型同步、布料或碰撞物理，没有任意地形脚底接触保证。第一 / 第三人称、衣领裙摆、遮挡与整段旅程需结合本轮实际渲染验收。Lux3D **未接入、未消费额度**；本版不宣称已经满足最终参赛版的 Lux3D 门槛。

请勿提交 `.env`、密钥、数据库、私人照片、个人信件、运行日志或依赖目录；当前 `.gitignore` 已排除这些内容。
