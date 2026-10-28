# 标准房间与本地 PBR 资源

本版房间使用以米为单位的可步行三维几何，客厅、厨房与阳台有真实门洞，模型中的墙壁和家具对应移动碰撞体。`walk` 模式显示四墙和天花；`overview` 隐藏前墙、客厅右墙和天花，便于寻找物件。窗外树、楼房、道路与车辆均为独立三维网格，没有把整张图片当作场景。

## 纹理来源

于 2026-10-28 从 Poly Haven 官方下载 1K JPG，运行时完全从本项目 `/assets/textures/` 加载，无远程依赖、无 API Key。所有文件的真实下载链接、字节数和 SHA-256 见 `frontend/public/assets/textures/sources.json`。

| 资产 | 使用 | 原始来源 | 许可 |
|---|---|---|---|
| wood_floor | 木地板与木家具，diffuse / OpenGL normal / roughness | https://polyhaven.com/a/wood_floor | CC0-1.0 |
| painted_plaster_wall | 墙面，diffuse / OpenGL normal / roughness | https://polyhaven.com/a/painted_plaster_wall | CC0-1.0 |
| fabric_pattern_07 | 蓝白沙发布与红色娃娃织物，color / OpenGL normal / roughness | https://polyhaven.com/a/fabric_pattern_07 | CC0-1.0 |

官方许可确认：https://polyhaven.com/license 。Poly Haven 声明其资产可用于任何目的并可随项目重新分发。此处保留来源记录以便审核。

几何家具、标准房间、灶台、冰箱、水槽、衣架、街景、电视、娃娃和三维相框均为本项目原创程序化模型；没有使用 Lux3D、没有伪造生成任务或 GLB 路径。人物模型由项目独立人物模块提供，授权记录见其说明。相框使用先前生成的原创合影；若文件缺失，有本地 Canvas 图像替代。

## 移动布局

- 客厅：x -4 至 4，z -3.5 至 3.5，高 2.9。
- 厨房：x -4 至 4，z -6.8 至 -3.5；通行门洞 x -2.1 至 -0.9。
- 阳台：x 4 至 6.8，z -2.8 至 2.8；客厅门洞 z -0.9 至 0.9。
- `Room.tsx` 导出 `ANCHOR_POSITIONS`、`WALK_COLLIDERS` 和 `SCENE_ZONES`；视角、移动与叙事状态由外层统一管理。
- 真实分支的人物离开动作仅在调用方明确传入 `realDeparture=true` 时出现。其他真实记忆不补写离开事件。想象分支新增第二茶杯与局部暖光，文字边界由界面明确标注。

PBR 图像加载失败时保留可导航的基础材质，不将纹理加载作为剧情阻塞。尚不能将本版视觉称为摄影级重建；这是贴图、实际尺度与标准空间布局的工程升级。
