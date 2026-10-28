# 一起开发 MemoryBox

根目录 `index.html` 是可以直接双击的完整离线成品。不要手工修改其中的压缩代码；功能开发请修改 `frontend/src` 与 `backend/app`，然后重新生成成品。

## 开始

```powershell
git clone https://github.com/lihao123456521/memorybox.git
Set-Location memorybox
```

只体验：双击根目录 `index.html`。此模式无网络依赖，回忆和信件保存在使用者自己的浏览器里，不会提交回 GitHub。

开发：在 Windows 运行 `start-memorybox.ps1`，或按 README 的命令分别启动前后端。源代码跨平台可运行；一键脚本针对 Windows。

## 分支和提交

有仓库写权限的协作者可以建分支。其他队友先在 GitHub 点击 Fork，然后克隆自己的仓库；把下例的 `YOUR_USERNAME` 换成自己的 GitHub 用户名：

```powershell
git clone https://github.com/YOUR_USERNAME/memorybox.git
Set-Location memorybox
git remote add upstream https://github.com/lihao123456521/memorybox.git
```

若已经克隆了原仓库，Fork 后可用 `git remote set-url origin https://github.com/YOUR_USERNAME/memorybox.git` 把推送目标改成自己的副本。修改完成后把自己的分支推送到 Fork，在 GitHub 向原仓库的 `main` 提交 Pull Request。

```powershell
git switch -c feature/your-change
# 修改源代码并验证
git add frontend/src backend/app docs
git commit -m "Describe the change"
git push -u origin feature/your-change
```

模型和贴图的来源必须记入素材清单。禁止提交 `.env`、真实密钥、数据库、私人照片、个人信件、浏览器状态、`node_modules`、Python虚拟环境和运行日志。

## 提交前验证与重新打包

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:portable
Set-Location ..
```

重新打开根目录 `index.html`，确认三维场景、行走、三个物件、分支、写信和刷新后收藏正常，再把新成品一并提交：

```powershell
git add index.html frontend/package-lock.json
git commit -m "Update portable MemoryBox build"
```

后端独立验证见 README。数据库默认仅用于本机，不在公开仓库共享。GitHub 的源码协作与每个人自己的回忆数据彼此独立。
