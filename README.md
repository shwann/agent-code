# AgentCode

基于 agent-code 泄露源码修复的本地可运行版本，支持接入任意 Anthropic 兼容 API（MiniMax、OpenRouter 等）。在完整 TUI 之外，本项目补全了 Computer Use（macOS / Windows）、打造了图形化桌面端，并支持通过 Telegram / 飞书完整远程驱动。

AgentCode 的目标是把 agent-code 从“只能在特定官方环境里运行的 CLI”整理成一个可本地部署、可远程访问、可图形化使用、可接入多家模型供应商的工程化版本。

## 目录

- [核心能力](#核心能力)
- [适合场景](#适合场景)
- [快速开始](#快速开始)
- [模型配置](#模型配置)
- [Docker 部署](#docker-部署)
- [图形化桌面端](#图形化桌面端)
- [Computer Use](#computer-use)
- [Telegram / 飞书远程驱动](#telegram--飞书远程驱动)
- [项目与工作区](#项目与工作区)
- [权限与安全](#权限与安全)
- [常见问题](#常见问题)
- [开发命令](#开发命令)
- [相关文档](#相关文档)
- [声明](#声明)

## 核心能力

- 完整 TUI：保留 agent-code 原始 Ink 终端交互体验。
- 无头模式：支持 `--print`，适合脚本、CI、自动化调用。
- Anthropic 兼容 API：支持 MiniMax、OpenRouter、LiteLLM、DeepSeek 代理、Ollama 代理等兼容接口。
- 多模型映射：支持分别配置主模型、Sonnet、Haiku、Opus 等默认模型别名。
- Web 服务端：提供本地 API / WebSocket 服务，供桌面端、Web UI、IM adapter 复用。
- 图形化桌面端：React + Tauri，支持多标签、多会话、模型切换、权限切换、文件查看、Diff 展示。
- Docker Web 版：浏览器访问，适合服务器部署和远程使用。
- Computer Use：支持桌面截图、鼠标、键盘等自动化能力，覆盖 macOS / Windows 场景。
- Telegram / 飞书远程驱动：可通过 IM 发起任务、继续会话、审批权限、接收结果。
- MCP / Skills / Agents：保留并扩展 MCP、技能、子代理、多 Agent 协作能力。
- 项目管理：支持在 `/workspace` 下创建项目，并维护项目注册信息。

## 适合场景

- 想在本地或私有服务器上运行 agent-code。
- 想接入非官方 Anthropic 供应商，例如 MiniMax、OpenRouter、火山方舟、LiteLLM 代理。
- 想通过浏览器或桌面端管理多个项目和会话。
- 想把 coding agent 接入 Telegram / 飞书，实现移动端远程操作。
- 想在可控环境中使用 Computer Use 自动化桌面操作。
- 想研究 agent-code 的 TUI、权限系统、工具系统、MCP、Skills 和多 Agent 架构。

## 快速开始

### 1. 安装 Bun

macOS / Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

macOS Homebrew:

```bash
brew install bun
```

Windows PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

精简 Linux 镜像如果提示缺少 `unzip`，先安装：

```bash
apt update && apt install -y unzip
```

### 2. 安装依赖

```bash
bun install
cp .env.example .env
```

编辑 `.env`，填入模型供应商配置。

### 3. 启动 TUI

```bash
./bin/agent-code
```

无头模式：

```bash
./bin/agent-code -p "帮我解释这个项目的结构"
```

查看参数：

```bash
./bin/agent-code --help
```

### 4. Windows 使用

Windows 建议安装 Git for Windows。可以直接用 Bun 启动：

```powershell
bun --env-file=.env ./src/entrypoints/cli.tsx
```

也可以在 Git Bash 中运行：

```bash
./bin/agent-code
```

## 模型配置

AgentCode 通过 Anthropic 兼容接口调用模型。核心环境变量如下：

```env
ANTHROPIC_AUTH_TOKEN=your-api-key-or-token
ANTHROPIC_BASE_URL=https://your-provider.example.com/anthropic

ANTHROPIC_MODEL=your-main-model
ANTHROPIC_DEFAULT_SONNET_MODEL=your-sonnet-model
ANTHROPIC_DEFAULT_HAIKU_MODEL=your-haiku-model
ANTHROPIC_DEFAULT_OPUS_MODEL=your-opus-model

API_TIMEOUT_MS=600000
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

### MiniMax 示例

```env
ANTHROPIC_AUTH_TOKEN=your_minimax_api_key
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_MODEL=MiniMax-M2.7
ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M2.7
ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M2.7
API_TIMEOUT_MS=3000000
```

### OpenRouter 示例

```env
ANTHROPIC_AUTH_TOKEN=sk-or-v1-xxx
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1
ANTHROPIC_MODEL=provider/model-id
ANTHROPIC_DEFAULT_SONNET_MODEL=provider/model-id
ANTHROPIC_DEFAULT_HAIKU_MODEL=provider/model-id
ANTHROPIC_DEFAULT_OPUS_MODEL=provider/model-id
```

### LiteLLM / OpenAI 代理示例

先启动 LiteLLM：

```bash
litellm --config litellm_config.yaml --port 4000
```

再配置：

```env
ANTHROPIC_AUTH_TOKEN=sk-anything
ANTHROPIC_BASE_URL=http://localhost:4000
ANTHROPIC_MODEL=gpt-4o
ANTHROPIC_DEFAULT_SONNET_MODEL=gpt-4o
ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-4o-mini
ANTHROPIC_DEFAULT_OPUS_MODEL=gpt-4o
```

更多说明见 [第三方模型指南](docs/guide/third-party-models.md) 和 [环境变量文档](docs/guide/env-vars.md)。

## Docker 部署

Docker 部署适合服务器 Web 版使用。默认服务结构：

- `app`：AgentCode API / WebSocket 服务。
- `web`：Nginx 静态 Web UI 和反向代理。
- `adapters`：Telegram / 飞书等 IM adapter sidecar。

### 1. 准备 `.env`

默认 `docker compose` 会读取仓库根目录 `.env`。最小配置：

```env
SERVER_AUTH_TOKEN=change-me-to-a-random-secret
SERVER_AUTH_REQUIRED=1

ANTHROPIC_AUTH_TOKEN=your-api-key
ANTHROPIC_BASE_URL=https://your-provider.example.com/anthropic
ANTHROPIC_MODEL=your-model
ANTHROPIC_DEFAULT_SONNET_MODEL=your-model
ANTHROPIC_DEFAULT_HAIKU_MODEL=your-model
ANTHROPIC_DEFAULT_OPUS_MODEL=your-model

AGENT_CODE_HOST_WORKSPACE_DIR=./workspace
AGENT_CODE_RUN_USER=agentcode
AGENT_CODE_UID=1001
AGENT_CODE_GID=1001
AGENT_CODE_HOME=/home/agentcode
AGENT_CODE_CHOWN_WORKSPACE=auto

VITE_ENABLE_COMPUTER_USE=0
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

说明：

- `AGENT_CODE_HOST_WORKSPACE_DIR` 是宿主机工作区目录。
- 容器内工作区固定为 `/workspace`。
- Web UI 里选择项目时应使用 `/workspace` 或 `/workspace/xxx`，不要使用宿主机路径。
- `AGENT_CODE_UID` / `AGENT_CODE_GID` 建议设置为宿主机工作区目录属主，避免 bind mount 权限问题。
- 容器默认不会以 root 运行服务，配置目录在 `/home/agentcode/.claude`。

Linux 服务器上可用下面命令查看当前用户 UID/GID：

```bash
id -u
id -g
```

### 2. 启动

```bash
docker compose down && docker compose build && docker compose up -d
```

打开：

```text
http://127.0.0.1:8080
```

如果配置了 `SERVER_AUTH_TOKEN`，页面会要求输入访问密码。

### 3. 检查状态

```bash
docker compose ps
docker compose logs -f app
```

检查容器内实际配置：

```bash
docker compose exec app sh -lc 'echo $HOME; echo $CLAUDE_CONFIG_DIR; echo $AGENT_CODE_WORKSPACE_DIR'
```

### 4. Docker 常见注意事项

- 不要把宿主机根目录挂载为 workspace。
- 不要把 `.env`、API key、IM token 上传到公开仓库。
- `.dockerignore` 已排除 `.env` / `.env.*`，避免敏感配置进入镜像。
- 如果新建项目时报 `/root/.claude` 权限错误，说明旧镜像或旧 `.env` 仍在生效，重新执行 `docker compose down && docker compose build && docker compose up -d`。
- 如果已有 volume 里存在旧配置，必要时备份后再清理 volume。

完整说明见 [Docker 部署指南](docs/guide/docker-deployment.md)。

## 图形化桌面端

桌面端位于 `desktop/`，基于 React + Tauri 2。它提供：

- 多标签会话管理。
- 项目选择与新建项目。
- 模型和推理强度切换。
- 权限模式切换。
- 消息流式展示。
- 文件引用、附件、Diff、工具调用展示。
- 定时任务和 IM adapter 配置入口。

开发联调时需要同时启动服务端和前端。

启动 API 服务：

```bash
SERVER_PORT=3456 bun run src/server/index.ts
```

启动桌面前端：

```bash
cd desktop
bun install
bun run dev --host 127.0.0.1 --port 2024
```

浏览器打开：

```text
http://127.0.0.1:2024
```

构建桌面 Web 资源：

```bash
cd desktop
bun run build
```

更多见 [桌面端文档](docs/desktop/)。

## Computer Use

Computer Use 用于让 Agent 操作本机桌面，包括截图、点击、输入、窗口操作等。当前重点覆盖：

- macOS
- Windows
- 桌面端 / 本地服务场景

Docker / Web 远程部署时通常不建议开启 Computer Use，可设置：

```env
VITE_ENABLE_COMPUTER_USE=0
SERVER_ENABLE_COMPUTER_USE=0
```

相关文档：

- [Computer Use 功能指南](docs/features/computer-use.md)
- [Computer Use 架构解析](docs/features/computer-use-architecture.md)

## Telegram / 飞书远程驱动

AgentCode 支持通过 IM 平台远程控制 Agent，适合移动端或团队协作场景。典型能力：

- 通过 Telegram / 飞书发起任务。
- 绑定用户和访问权限。
- 选择项目和继续会话。
- 接收流式结果。
- 远程审批权限请求。
- 接收图片、文件和任务状态。

相关文档：

- [Telegram 配置](docs/im/telegram.md)
- [飞书配置](docs/im/feishu.md)
- [Channel 系统架构](docs/channel/01-channel-system.md)

## 项目与工作区

Docker 部署时，容器内项目都应位于：

```text
/workspace
```

Web UI 的“新建项目”会：

1. 在 `/workspace` 下创建项目目录。
2. 初始化项目说明文件。
3. 在 `${CLAUDE_CONFIG_DIR}/agent-code-projects.json` 里登记项目名称、描述、路径等信息。

默认 Docker 配置下 registry 文件路径为：

```text
/home/agentcode/.claude/agent-code-projects.json
```

不要把项目创建到 `/root` 或宿主机绝对路径中。

## 权限与安全

AgentCode 的权限模式包括：

- `default`：执行敏感操作前询问。
- `acceptEdits`：自动接受编辑类操作。
- `plan`：规划模式。
- `bypassPermissions`：绕过权限确认。

Docker 服务不会以 root 用户运行。如果服务进程是 root，`bypassPermissions` 会被禁用，避免在高权限容器中误放开执行边界。

安全建议：

- 生产环境必须设置强随机 `SERVER_AUTH_TOKEN`。
- 只暴露 `web` 端口，不要直接暴露 `app:3456` 到公网。
- 外层建议使用 HTTPS 反向代理。
- workspace 使用独立目录，不要挂载宿主机根目录、家目录或敏感目录。
- 谨慎开启 `bypassPermissions` 和 Computer Use。
- 不要把 `.env`、`.claude`、IM token、日志中的 API key 发到公开 issue。

## 常见问题

### 页面提示 Missing Authorization header

设置了 `SERVER_AUTH_TOKEN` / `SERVER_AUTH_REQUIRED=1` 后，Web 页面需要先登录。正常情况下会出现密码输入框。如果直接请求 API，需要携带：

```bash
Authorization: Bearer your-token
```

### Docker 新建项目报 `/root/.claude` 权限错误

通常是旧 `.env` 或旧镜像中仍有：

```env
AGENT_CODE_PROJECTS_FILE=/root/.claude/agent-code-projects.json
```

处理方式：

```bash
docker compose down && docker compose build && docker compose up -d
```

并确认 `.env` 不再指定 `/root/.claude`。

### Docker 下看不到 Computer Use

Docker/Web 场景默认建议关闭 Computer Use：

```env
VITE_ENABLE_COMPUTER_USE=0
SERVER_ENABLE_COMPUTER_USE=0
```

页面以服务端能力开关为准。

### Web Search 没有结果

部分模型供应商不支持 Anthropic 的 `web_search_20250305` 工具。需要使用供应商支持的搜索工具，或者在 AgentCode 侧配置代理搜索服务。具体见搜索和模型供应商相关文档。

### 端口被占用

检查端口：

```bash
lsof -nP -iTCP:3456 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

停止旧进程后重新启动。

## 开发命令

根项目：

```bash
bun install
bun run start
SERVER_PORT=3456 bun run src/server/index.ts
bun test
```

桌面端：

```bash
cd desktop
bun install
bun run dev
bun run build
bun run lint
bun run test
```

文档：

```bash
bun run docs:dev
bun run docs:build
```

Docker：

```bash
docker compose config
docker compose build
docker compose up -d
docker compose logs -f
```

## 相关文档

- [环境变量](docs/guide/env-vars.md)
- [Docker 部署](docs/guide/docker-deployment.md)
- [第三方模型](docs/guide/third-party-models.md)
- [全局使用](docs/guide/global-usage.md)
- [常见问题](docs/guide/faq.md)
- [桌面端](docs/desktop/)
- [Computer Use](docs/features/computer-use.md)
- [Telegram](docs/im/telegram.md)
- [飞书](docs/im/feishu.md)
- [Channel 系统](docs/channel/01-channel-system.md)
- [多 Agent 系统](docs/agent/01-usage-guide.md)
- [Skills 系统](docs/skills/01-usage-guide.md)
- [记忆系统](docs/memory/01-usage-guide.md)
- [源码修复记录](docs/reference/fixes.md)
- [项目结构](docs/reference/project-structure.md)

## 分享文案

AgentCode 是一个基于 agent-code 泄露源码修复的本地可运行版本，支持接入任意 Anthropic 兼容 API，如 MiniMax、OpenRouter、LiteLLM 代理等。它保留完整 TUI 能力，同时补全了 Web 服务端、图形化桌面端、Docker 部署、Computer Use、Telegram / 飞书远程驱动和项目管理能力，适合本地开发、私有化部署、移动端远程控制 coding agent 以及研究 agent-code 工程实现。

## 声明

本仓库基于 2026-03-31 从 Anthropic npm registry 泄露的 agent-code 源码整理和修复。所有原始源码版权归 Anthropic 所有。本项目仅供学习、研究和本地实验使用。使用者需自行承担使用第三方模型、自动化执行、远程控制和源码研究带来的风险。
