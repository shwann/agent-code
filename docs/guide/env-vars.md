# 环境变量说明

AgentCode 支持从环境变量、`.env` 文件和 `~/.claude/settings.json` 读取配置。

优先级：

```text
环境变量 > .env 文件 > ~/.claude/settings.json
```

## 模型供应商

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 二选一 | API Key，通过 `x-api-key` 头发送。 |
| `ANTHROPIC_AUTH_TOKEN` | 二选一 | Bearer Token，通过 `Authorization: Bearer` 头发送。 |
| `ANTHROPIC_BASE_URL` | 否 | Anthropic 兼容 API 地址。未设置时使用默认 Anthropic 地址。 |
| `ANTHROPIC_MODEL` | 否 | 默认主模型。 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 否 | Sonnet 级别模型映射。 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 否 | Haiku 级别模型映射。 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 否 | Opus 级别模型映射。 |
| `API_TIMEOUT_MS` | 否 | API 请求超时，默认 600000 毫秒。 |

推荐基础配置：

```env
ANTHROPIC_AUTH_TOKEN=your-api-key-or-token
ANTHROPIC_BASE_URL=https://your-provider.example.com/anthropic
ANTHROPIC_MODEL=your-model
ANTHROPIC_DEFAULT_SONNET_MODEL=your-model
ANTHROPIC_DEFAULT_HAIKU_MODEL=your-model
ANTHROPIC_DEFAULT_OPUS_MODEL=your-model
API_TIMEOUT_MS=600000
```

## MiniMax 示例

```env
ANTHROPIC_AUTH_TOKEN=your_minimax_api_key
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_MODEL=MiniMax-M2.7
ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M2.7
ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M2.7
API_TIMEOUT_MS=3000000
```

国内端点可按供应商文档替换为对应域名。

## OpenRouter 示例

```env
ANTHROPIC_AUTH_TOKEN=sk-or-v1-xxx
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1
ANTHROPIC_MODEL=provider/model-id
ANTHROPIC_DEFAULT_SONNET_MODEL=provider/model-id
ANTHROPIC_DEFAULT_HAIKU_MODEL=provider/model-id
ANTHROPIC_DEFAULT_OPUS_MODEL=provider/model-id
```

## LiteLLM 示例

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

更多模型接入说明见 [第三方模型接入](./third-party-models.md)。

## 服务端与 Web 鉴权

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SERVER_HOST` | 否 | 服务端监听地址，Docker 默认 `0.0.0.0`。 |
| `SERVER_PORT` | 否 | 服务端端口，默认 `3456`。 |
| `SERVER_AUTH_TOKEN` | Docker 建议必填 | Web / API / Adapter 访问服务端的 Bearer Token。 |
| `SERVER_AUTH_REQUIRED` | 否 | 设为 `1` 时强制启用鉴权。 |
| `SERVER_ENABLE_COMPUTER_USE` | 否 | 服务端 Computer Use 开关。 |
| `VITE_ENABLE_COMPUTER_USE` | 否 | 前端 Computer Use 开关。Docker Web 场景通常设为 `0`。 |

示例：

```env
SERVER_AUTH_TOKEN=change-me-to-a-random-secret
SERVER_AUTH_REQUIRED=1
SERVER_PORT=3456
VITE_ENABLE_COMPUTER_USE=0
SERVER_ENABLE_COMPUTER_USE=0
```

如果直接请求 API，需要携带：

```bash
Authorization: Bearer your-token
```

## Docker 工作区和运行用户

Docker 部署时推荐显式设置运行用户。服务进程不应以 root 运行。

| 变量 | 说明 |
| --- | --- |
| `AGENT_CODE_HOST_WORKSPACE_DIR` | 宿主机工作区目录。Compose 会挂载到容器内 `/workspace`。 |
| `AGENT_CODE_RUN_USER` | 容器内运行用户，默认 `agentcode`。 |
| `AGENT_CODE_UID` | 容器内运行用户 UID，默认 `1001`。Linux 服务器建议改为宿主机工作区属主 UID。 |
| `AGENT_CODE_GID` | 容器内运行用户 GID，默认 `1001`。Linux 服务器建议改为宿主机工作区属主 GID。 |
| `AGENT_CODE_HOME` | 容器内用户 HOME，默认 `/home/agentcode`。 |
| `AGENT_CODE_CHOWN_WORKSPACE` | workspace 权限修复策略：`auto`、`true`、`false`。 |
| `CLAUDE_CONFIG_DIR` | 配置目录。Docker 默认 `${AGENT_CODE_HOME}/.claude`。 |

推荐 Docker 配置：

```env
AGENT_CODE_HOST_WORKSPACE_DIR=./workspace
AGENT_CODE_RUN_USER=agentcode
AGENT_CODE_UID=1001
AGENT_CODE_GID=1001
AGENT_CODE_HOME=/home/agentcode
AGENT_CODE_CHOWN_WORKSPACE=auto
```

Linux 服务器可用下面命令查看当前用户 UID/GID：

```bash
id -u
id -g
```

注意：

- 容器内工作区固定为 `/workspace`。
- Web UI 里应选择 `/workspace` 或 `/workspace/xxx`。
- 不要在 Docker 中把项目路径配置到 `/root`。
- 不要设置 `AGENT_CODE_PROJECTS_FILE=/root/.claude/agent-code-projects.json`。

## 隐私和网络

| 变量 | 说明 |
| --- | --- |
| `DISABLE_TELEMETRY` | 设为 `1` 禁用遥测。 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 设为 `1` 禁用非必要网络请求。 |

推荐：

```env
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

## 配置文件方式

也可以写入 `~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx",
    "ANTHROPIC_BASE_URL": "https://api.minimax.io/anthropic",
    "ANTHROPIC_MODEL": "MiniMax-M2.7"
  }
}
```

本地 CLI 适合使用 `~/.claude/settings.json`。Docker 部署更推荐使用 `.env` 和 Compose 环境变量。
