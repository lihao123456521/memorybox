# MemoryBox 0.3.0 实测记录

验证日期：2026-10-29；Windows、Node 24、Python 3.14。截图来自实际运行的 Three.js 场景。首次全量与后续针对性复验分别记录，没有将局部重跑伪写为一次全量通过。

## 最终验证

| 范围 | 结果与证据 |
|---|---|
| 前后端 | `start-memorybox.ps1 -NoBrowser` 启动成功；5173 页面与8000 `/api/health` 返回200；模板模式，Lux3D关闭 |
| 类型与普通构建 | `npm run build` 通过，包含TypeScript；Vite保留500KB分块提示 |
| 单文件构建 | `npm run build:portable` 通过，内嵌50项资产，43,399,205字节（约41.4MiB）；GLB无外部资源或解码器，脚本语法及边界检查通过 |
| 软件许可 | 68个生产依赖目录、79份原始许可/声明来源；根许可文本180,019字节，已核对同一文本完整HTML转义内嵌。上游未提供独立许可的情况在文本中明确说明 |
| 后端 | 在backend运行 `.venv/Scripts/python.exe -m pytest -q`，19项通过 |
| 首次全量浏览器 | 23项中20通过、3失败，32.1分钟；保留原报告 `artifacts/playwright-v3-full-results.json`，失败处理见下节 |
| 人物刷新复验 | 四类角色逐一加载、选择持久化、刷新后正确GLB与选择按钮通过；`artifacts/v3-focused-review/focused-results.json` 中该项通过 |
| 正常机械过渡复验 | 1项通过，81.5秒；检测到真实盒盖旋转、圆筒转动、opacity=1、25px模糊以及遮罩存在时memory世界已准备好；报告 `focused-mechanical-results.json` 与原始 `mechanical-observations.json` 位于上述目录 |
| 八音盒输入 | 拖动只旋转、明确点击三维模型才开盖，1项通过；`artifacts/playwright-v3-input-results.json` |
| 最终Edge复验 | 5项全部通过，6.7分钟；三个独立file世界、车站完整行走与信件、教室走廊通行；`artifacts/playwright-v3-edge-final-results.json` |
| 单HTML完整闭环 | 仅复制最终index.html到空目录，阻断HTTP；人物与家具、WASD、四人物切换、三旧物、想象分支、精确信件、返回收藏、刷新读取及删除均通过 |
| 单HTML依赖 | 三个场景均检查HTTP请求=0、其他本地文件请求=0、页面JavaScript错误=0；没有放宽浏览器本地文件访问权限 |
| 老屋与其他回归 | 五房间通行、墙/桌碰撞、镜头位置恢复、真实与想象双分支、自定义事实、断线同步、丢响应幂等、删除与恢复状态清理、触屏输入均通过首次全量中的对应项目 |
| 窄屏 | 1366×768、1920×1080、390×844、319×873无横向溢出；390px完成探索、分支、写信与收藏 |
| 最后碰撞修正 | 候车椅、站台椅、车厢侧桌和旋转门扇数值采样阻挡正确；原路线保持可通。随后Edge实际走过车厢中道和教室后门 |

最终HTML SHA-256：`199827a164cccac8dd876ce85402beb87018ad64acd919b3c32f7ca213742413`。

## 首次失败与复验处理

1. 便携用例在transition-in结束前按左移，导航按设计尚未解锁。测试改为等待实际exploration及navigation-paused=false，再按键；最终Edge全流程通过。
2. 人物刷新断言只有12秒，而原trace的真实首帧在13.43秒后完成。测试先等memory首帧和实际GLB，再核对角色；复验通过，没有更改人物选择逻辑。
3. 软件WebGL长帧使跨进程轮询错过CSS透明度峰值。改为页面内逐帧记录实际透明度、模糊与世界状态，并保留原始观测；正常动画复验通过。没有关闭动画、跳转动画进度或为测试延长产品动画。

最后增加的八音盒输入用例与原23项共同覆盖24个不同用例；上述记录按实际运行批次分别计数，不宣称最后重新单次跑完24项。

## GitHub 下载验证

公开仓库：[lihao123456521/memorybox](https://github.com/lihao123456521/memorybox)，权限为PUBLIC；v0.3代码提交为 `dccb394`，后续仅补充验证文档。

- 用不带认证头的HTTP请求下载源码ZIP，提取唯一的根index.html，SHA-256与本机完全一致。把这份下载HTML复制到空目录、阻断全部HTTP，用Edge重新执行行走、四人物、剧情、精确信件、刷新和删除：**1项通过，2.9分钟**；报告 `artifacts/playwright-v3-github-download-results.json`。
- [v0.3.0离线包](https://github.com/lihao123456521/memorybox/releases/tag/v0.3.0)已公开发布，包含ZIP与SHA256SUMS。ZIP也已匿名下载，压缩包与解压HTML均和本机逐字节哈希一致，校验文件也一致。核验记录 `artifacts/github-v3-release/download-verification.json`。没有把相同字节的release HTML再计作一次独立浏览器复验。
- [代码提交的GitHub Actions](https://github.com/lihao123456521/memorybox/actions/runs/40821046733)成功；Ubuntu、Node24、Python3.12完成类型检查、普通构建、单文件打包与19项后端测试。
- 第一次附件上传因GitHub返回408超时失败；重试后成功，最终附件状态为uploaded，发布状态非draft。

离线ZIP仅含index.html与打开说明，软件许可已在HTML内嵌。ZIP SHA-256：`5f2baec588731544d39d21326f26877be6c0cf816aa8d35b7c71088ad312c949`。

## 画面与边界

公开演示图保存在 `docs/screenshots/`；本机原始输出在 `artifacts/qa-v3/`、`artifacts/offline-only/` 与 `artifacts/offline-worlds/`，不提交个人浏览器状态、信件、数据库或日志。早期qa-v2目录被部分本轮测试沿用，不能仅凭目录名称判断版本。

- 自动化使用Chromium / Edge与SwiftShader，没有测量物理GPU帧率；窄屏视口不是实体手机、iPad或Safari验证。
- 人物为通用虚构角色，采用完整人体、衣物、发型与皮肤；目前是静态站姿/坐姿与轻微呼吸，没有完整骨骼表演或口型，尚非摄影级重建。
- 老屋、车站和教室是独立可通行的艺术化空间，不表示真实历史地点的精确重建。
- 收藏属于当前文件和当前浏览器的存储范围。移动文件、换浏览器或清理数据可能使原收藏不可见；私人文字不随下载包传播。
- 叙事使用明确标记的本地模板；无API Key可完成全部体验。没有Lux3D调用或额度消耗，不宣称满足最终参赛版全部要求。
- pytest保留Starlette/httpx弃用提示，未为消除提示擅自升级依赖。
