# 桌面端打包指南

本文记录本项目桌面安装包的本地构建流程，适用于在 macOS Apple Silicon 上构建 `agent-code.app` 和 `.dmg` 安装包。

## 构建入口

桌面端位于 `desktop/` 目录，技术栈为 Tauri v2 + React + Vite。项目已经提供了 macOS Apple Silicon 的标准打包脚本：

```bash
cd desktop
SKIP_INSTALL=1 bun run build:macos-arm64
```

等价于：

```bash
cd desktop
SKIP_INSTALL=1 bash ./scripts/build-macos-arm64.sh
```

脚本会依次执行：

1. 清理旧的 sidecar、Tauri bundle 和前端 `dist`
2. 执行 `bun run build` 构建前端
3. 执行 `TAURI_ENV_TARGET_TRIPLE=aarch64-apple-darwin bun run build:sidecars` 构建 sidecar
4. 执行 `tauri build --target aarch64-apple-darwin --bundles app,dmg`
5. 将 `.app` 和 `.dmg` 复制到固定产物目录

## 环境要求

必须在 Apple Silicon macOS 上运行：

```bash
uname -s
uname -m
```

期望输出分别为：

```text
Darwin
arm64
```

本地需要安装这些命令：

```bash
bun
cargo
rustc
codesign
hdiutil
```

可以用下面命令检查：

```bash
command -v bun
command -v cargo
command -v rustc
command -v codesign
command -v hdiutil
```

## 依赖安装

首次构建前建议安装三个位置的依赖：

```bash
# 仓库根目录
bun install

# 桌面端
cd desktop
bun install

# IM adapters，sidecar 编译会解析这里的依赖
cd ../adapters
bun install
```

如果依赖已经安装完成，后续打包可以使用 `SKIP_INSTALL=1` 跳过安装步骤：

```bash
cd ../desktop
SKIP_INSTALL=1 bun run build:macos-arm64
```

如果不确定依赖是否齐全，可以不加 `SKIP_INSTALL=1`，脚本会自动执行根目录和 `desktop/` 的 `bun install`。注意：当前脚本不会自动安装 `adapters/` 依赖，缺失时需要手动进入 `adapters/` 执行 `bun install`。

## 构建命令

推荐从 `desktop/` 目录执行：

```bash
cd desktop
SKIP_INSTALL=1 bun run build:macos-arm64
```

构建成功后，终端末尾会出现类似输出：

```text
[build-macos-arm64] Build finished.
[build-macos-arm64] DMG source: .../desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/agent-code_0.1.7_aarch64.dmg
[build-macos-arm64] App source: .../desktop/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/agent-code.app
[build-macos-arm64] Canonical output: .../desktop/build-artifacts/macos-arm64
```

## 产物位置

最终产物固定输出到：

```bash
desktop/build-artifacts/macos-arm64/
```

典型文件如下：

```text
BUILD_INFO.txt
agent-code.app
agent-code_0.1.7_aarch64.dmg
```

其中 `.dmg` 是给用户安装用的桌面安装包，`.app` 是应用包本体，`BUILD_INFO.txt` 记录目标架构、源产物和构建时间。

## 本次成功构建记录

本次本地成功构建命令：

```bash
cd desktop
SKIP_INSTALL=1 bun run build:macos-arm64
```

生成产物：

```text
desktop/build-artifacts/macos-arm64/agent-code_0.1.7_aarch64.dmg
desktop/build-artifacts/macos-arm64/agent-code.app
desktop/build-artifacts/macos-arm64/BUILD_INFO.txt
```

构建过程中实际发生的关键点：

- 前端 `tsc -b && vite build` 成功
- sidecar 构建依赖 `adapters/`，需要先安装 `grammy` 和 `@larksuiteoapi/node-sdk`
- sidecar 会把根目录 `src/server/index.ts` 一起编译进桌面端本地服务
- Tauri/Rust 阶段需要访问 `crates.io` 下载或更新 Rust 依赖
- 脚本默认使用 `--no-sign`，因此生成的是未正式签名的本地安装包

## 本地密码登录

桌面端的登录弹窗来自本地 server 的鉴权响应。设置 `SERVER_AUTH_TOKEN` 后，桌面端请求 API 会先收到 `401`，前端随后显示二次确认密码输入框；输入的值会保存在当前浏览器会话中，点击「退出登录」会清除会话 token 并刷新页面。

开发模式可以这样启动：

```bash
SERVER_AUTH_TOKEN=your-local-password SERVER_PORT=3456 bun run src/server/index.ts

cd desktop
bun run dev --host 127.0.0.1 --port 2024
```

桌面安装包中，Tauri 会启动内置 sidecar server。密码不会在构建时写死进安装包；需要运行时环境里存在 `SERVER_AUTH_TOKEN`。如果通过 Finder 双击启动 `.app`，请把 `SERVER_AUTH_TOKEN` 配到登录 shell 环境中，例如 zsh 的 `~/.zprofile`，然后重新打开应用。

如果没有设置 `SERVER_AUTH_TOKEN`，本地 `127.0.0.1` server 会按无密码模式运行，这是正常行为。

## 常见问题

### sidecar 报 `Could not resolve: "grammy"`

错误示例：

```text
error: Could not resolve: "grammy". Maybe you need to "bun install"?
error: Could not resolve: "@larksuiteoapi/node-sdk". Maybe you need to "bun install"?
```

原因是 `adapters/node_modules` 不存在。处理方式：

```bash
cd adapters
bun install
```

然后重新打包：

```bash
cd ../desktop
SKIP_INSTALL=1 bun run build:macos-arm64
```

### Cargo 无法访问 `index.crates.io`

错误示例：

```text
failed to download from `https://index.crates.io/...`
Could not resolve host: index.crates.io
```

这是 Rust/Tauri 阶段需要下载依赖，但当前网络或沙箱无法解析 `crates.io`。处理方式：

1. 确认本机网络可以访问 `https://index.crates.io`
2. 在允许访问外网的终端中重新执行打包命令
3. 如果公司网络限制 crates.io，需要配置 Cargo 镜像源

### `bun install` 提示无法写入 tempdir

错误示例：

```text
error: bun is unable to write files to tempdir: PermissionDenied
```

处理方式：

1. 确认当前终端有权限写入系统临时目录
2. 换到正常用户终端执行
3. 必要时显式指定可写临时目录：

```bash
TMPDIR=/tmp bun install
```

### macOS 首次打开提示无法验证

本地构建默认未做 Apple 开发者签名，首次打开可能被 Gatekeeper 拦截。可以右键应用选择「打开」，或在安装到 `/Applications` 后执行：

```bash
xattr -cr /Applications/agent-code.app
```

## 签名构建

默认脚本会传入 `--no-sign`，适合本地测试包。如果要允许 Tauri 执行签名逻辑，可以设置：

```bash
cd desktop
SIGN_BUILD=1 SKIP_INSTALL=1 bun run build:macos-arm64
```

如果需要 notarization、stapling 或正式发布证书，还需要额外配置 Apple Developer 证书、环境变量和 Tauri 签名参数。正式桌面端发布仍建议使用仓库的 GitHub Actions release workflow。

## 正式发布

正式桌面端 release 不建议上传本地构建产物，而是通过 GitHub Actions 远程构建。项目约定流程：

```bash
bun run scripts/release.ts <version>
git push origin main --tags
```

要求对应版本的 release notes 已存在，例如：

```text
release-notes/v0.1.8.md
```

发布 workflow 为：

```text
.github/workflows/release-desktop.yml
```

它会在推送 `v*.*.*` tag 后自动构建并发布桌面安装包。

## Windows 构建

Windows x64 构建入口在 `desktop/package.json` 中：

```bash
cd desktop
bun run build:windows-x64
```

该命令会调用：

```text
desktop/scripts/build-windows-x64.ps1
```

需要在 Windows 环境中执行，并准备 Tauri/Rust/Windows installer 相关依赖。
