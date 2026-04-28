# 快速开始

本页介绍如何在本地启动 AgentCode TUI，以及如何启动桌面端开发环境。服务器部署请看 [Docker 部署指南](./docker-deployment.md)。

## 1. 安装 Bun

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

## 2. 安装依赖

```bash
bun install
cp .env.example .env
```

编辑 `.env`，填入模型供应商配置。完整变量说明见 [环境变量说明](./env-vars.md)。

## 3. 配置模型

AgentCode 通过 Anthropic 兼容接口调用模型。最小配置示例：

```env
ANTHROPIC_AUTH_TOKEN=your-api-key-or-token
ANTHROPIC_BASE_URL=https://your-provider.example.com/anthropic
ANTHROPIC_MODEL=your-model
ANTHROPIC_DEFAULT_SONNET_MODEL=your-model
ANTHROPIC_DEFAULT_HAIKU_MODEL=your-model
ANTHROPIC_DEFAULT_OPUS_MODEL=your-model

DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

MiniMax、OpenRouter、LiteLLM 等配置示例见 [第三方模型接入](./third-party-models.md)。

## 4. 启动 TUI

macOS / Linux:

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

## 5. Windows 使用

Windows 建议安装 Git for Windows。可以直接用 Bun 启动：

```powershell
bun --env-file=.env ./src/entrypoints/cli.tsx
```

也可以在 Git Bash 中运行：

```bash
./bin/agent-code
```

## 6. 启动本地服务端

桌面端、Web 前端和 WebSocket 会话都依赖本地服务端：

```bash
SERVER_PORT=3456 bun run src/server/index.ts
```

健康检查：

```bash
curl http://127.0.0.1:3456/health
```

## 7. 启动桌面前端

```bash
cd desktop
bun install
bun run dev --host 127.0.0.1 --port 2024
```

浏览器打开：

```text
http://127.0.0.1:2024
```

## 8. Docker Web 版

服务器部署推荐使用 Docker：

```bash
docker compose down && docker compose build && docker compose up -d
```

默认访问：

```text
http://127.0.0.1:8080
```

Docker 场景请重点配置：

```env
SERVER_AUTH_TOKEN=change-me-to-a-random-secret
SERVER_AUTH_REQUIRED=1
AGENT_CODE_HOST_WORKSPACE_DIR=./workspace
AGENT_CODE_RUN_USER=agentcode
AGENT_CODE_UID=1001
AGENT_CODE_GID=1001
AGENT_CODE_HOME=/home/agentcode
AGENT_CODE_CHOWN_WORKSPACE=auto
```

完整说明见 [Docker 部署指南](./docker-deployment.md)。

## 9. 全局使用

将 `bin/` 加入 PATH 后可在任意目录启动：

```bash
export PATH="$HOME/path/to/agent-code/bin:$PATH"
```

更多见 [全局使用指南](./global-usage.md)。

## 10. 降级模式

如果 Ink TUI 出现问题，可以使用 Recovery CLI 模式：

```bash
CLAUDE_CODE_FORCE_RECOVERY_CLI=1 ./bin/agent-code
```
