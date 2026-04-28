# Docker 部署指南

本文档说明如何用 `docker compose` 部署 cc-haha Web 版，并启用服务端、Web UI 和 IM Adapter。当前 Docker 方案适合“浏览器访问 + 远程使用”，不用于构建 Tauri 桌面安装包。

## 服务结构

根目录 `docker-compose.yml` 定义了三个服务：

| 服务 | 作用 | 对外暴露 |
| --- | --- | --- |
| `app` | Bun API / WebSocket 服务端，负责会话、任务、配置、模型调用 | 不直接暴露，仅容器内 `3456` |
| `web` | Nginx + Web UI 静态资源，并反向代理 `/api`、`/proxy`、`/ws` | 默认 `8080` |
| `adapters` | IM Adapter sidecar，默认启动飞书 adapter | 不暴露端口 |

相关文件：

- `docker-compose.yml`
- `Dockerfile.server`
- `Dockerfile.web`
- `docker/nginx.conf.template`
- `desktop/sidecars/claude-sidecar.ts`
- `adapters/`

`app` 和 `adapters` 使用同一个 `claude_data` volume，因此二者共享 `/root/.claude`。Web UI 写入的 IM 配置会落在 `/root/.claude/adapters.json`，adapter 容器会读取同一份配置。

## 前置要求

部署机器需要：

- Docker
- Docker Compose Plugin
- 能访问你的模型供应商 API
- 能访问 npm registry，用于构建镜像时安装依赖
- 一个宿主机工作区目录，用于挂载到容器内 `/workspace`

检查命令：

```bash
docker --version
docker compose version
```

## 环境变量

建议在仓库根目录创建 `.env.docker`，不要直接混用开发环境 `.env`。

最小示例：

```env
# Web UI 访问端口
CC_HAHA_HTTP_PORT=8080

# 服务端鉴权 token。生产环境必须改成随机强密码。
SERVER_AUTH_TOKEN=change-me-to-a-random-secret

# 宿主机工作区。Web UI 内应选择 /workspace 或 /workspace/xxx。
CC_HAHA_WORKSPACE_DIR=/data/cc-haha/workspace

# 时区
TZ=Asia/Shanghai

# 依赖安装源
NPM_CONFIG_REGISTRY=https://registry.npmjs.org/

# 模型供应商配置，按你的供应商选择 API key 或 auth token。
ANTHROPIC_API_KEY=your-api-key
# ANTHROPIC_AUTH_TOKEN=your-auth-token

# 第三方 Anthropic 兼容端点示例
ANTHROPIC_BASE_URL=https://your-provider.example.com/anthropic
ANTHROPIC_MODEL=your-model-id
ANTHROPIC_DEFAULT_SONNET_MODEL=your-model-id
ANTHROPIC_DEFAULT_HAIKU_MODEL=your-model-id
ANTHROPIC_DEFAULT_OPUS_MODEL=your-model-id

# 可选
API_TIMEOUT_MS=600000
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

如果使用 Anthropic 官方接口，通常只需要：

```env
ANTHROPIC_API_KEY=sk-ant-xxx
```

`SERVER_AUTH_TOKEN` 会同时注入 `app`、`web` 和 `adapters`。由于 `app` 监听 `0.0.0.0` 时会启用鉴权，adapter 调用 `/api/sessions` 和 `/ws/:sessionId` 也必须携带同一个 token。

## 准备目录

```bash
mkdir -p /data/cc-haha/workspace
cp .env.example .env.docker
```

然后编辑 `.env.docker`，补齐上面的关键变量。

注意：如果 `CC_HAHA_WORKSPACE_DIR=/data/cc-haha/workspace`，Web UI 内选择项目目录时应使用容器内路径：

```text
/workspace
/workspace/my-project
```

不要在 Web UI 里选择宿主机路径：

```text
/data/cc-haha/workspace/my-project
```

## 构建镜像

```bash
docker compose --env-file .env.docker build
```

只构建某个服务：

```bash
docker compose --env-file .env.docker build app
docker compose --env-file .env.docker build web
docker compose --env-file .env.docker build adapters
```

依赖缓存异常时使用：

```bash
docker compose --env-file .env.docker build --no-cache
```

`Dockerfile.server` 会分别安装根目录依赖和 `adapters/` 依赖。`adapters/` 里的飞书 SDK、Telegram SDK 不在根目录 `package.json` 中，不能省略这一步。

## 启动服务

```bash
docker compose --env-file .env.docker up -d
```

查看状态：

```bash
docker compose --env-file .env.docker ps
```

预期至少看到：

```text
cc-haha-app-1        Up
cc-haha-web-1        Up
cc-haha-adapters-1   Up
```

访问 Web UI：

```text
http://<服务器IP>:8080
```

如果修改了 `CC_HAHA_HTTP_PORT`，替换为对应端口。

## 查看日志

全部日志：

```bash
docker compose --env-file .env.docker logs -f
```

只看服务端：

```bash
docker compose --env-file .env.docker logs -f app
```

只看飞书 adapter：

```bash
docker compose --env-file .env.docker logs -f adapters
```

飞书 adapter 正常启动时应能看到类似日志：

```text
[claude-sidecar] starting Feishu adapter
[Feishu] Starting bot...
[Feishu] Server: ws://app:3456
[Feishu] Bot is running! (WebSocket connected)
```

## 飞书接入

默认 `adapters` 服务启动命令是：

```yaml
command: ["bun", "run", "desktop/sidecars/claude-sidecar.ts", "adapters", "--feishu"]
```

飞书凭据通过 Web UI 配置，写入 `/root/.claude/adapters.json`：

1. 打开 Web UI。
2. 进入设置里的 IM 接入。
3. 填写飞书 `appId`、`appSecret`，按需填写 `encryptKey`、`verificationToken`。
4. 保存配置。
5. 生成配对码。
6. 在飞书里私聊机器人，发送配对码完成绑定。

检查配置文件：

```bash
docker compose --env-file .env.docker exec app cat /root/.claude/adapters.json
```

不要把 `appSecret`、配对码或 `SERVER_AUTH_TOKEN` 贴到公开 issue 或日志里。

## 飞书绑定成功但不能发消息

按下面顺序排查。

### 1. adapter 容器是否运行

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs adapters --tail=200
```

如果没有 `adapters` 服务，或日志里没有 `starting Feishu adapter`，需要重新构建并启动：

```bash
docker compose --env-file .env.docker build app adapters
docker compose --env-file .env.docker up -d app adapters
```

### 2. 飞书长连接是否成功

正常日志应包含：

```text
[Feishu] Bot is running! (WebSocket connected)
```

如果没有这行，检查：

- 飞书应用 `appId` / `appSecret` 是否正确
- 飞书开发者后台是否启用了长连接接收事件
- 飞书应用是否发布或安装到了目标组织
- adapter 容器能否访问飞书开放平台

### 3. adapter 是否能访问 app API

```bash
docker compose --env-file .env.docker exec adapters bun -e 'const r=await fetch("http://app:3456/api/sessions/recent-projects",{headers:{Authorization:`Bearer ${process.env.SERVER_AUTH_TOKEN}`}}); console.log(r.status)'
```

预期输出：

```text
200
```

如果是 `401`：

- 确认 `.env.docker` 中设置了 `SERVER_AUTH_TOKEN`
- 确认 `docker-compose.yml` 中 `app`、`web`、`adapters` 都注入同一个 `SERVER_AUTH_TOKEN`
- 修改后重新 `up -d`

### 4. 用户是否已配对

检查配对用户数量：

```bash
docker compose --env-file .env.docker exec adapters bun -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("/root/.claude/adapters.json","utf8")); console.log({pairedUsers:(c.feishu?.pairedUsers||[]).length, pairingActive:Date.now()<c.pairing?.expiresAt})'
```

如果 `pairedUsers` 是 `0`，说明还没有完成身份绑定。去 Web UI 重新生成配对码，然后在飞书私聊机器人发送该配对码。

如果 `pairingActive` 是 `false`，说明配对码已过期，需要重新生成。

### 5. 看完整启动日志

```bash
docker compose --env-file .env.docker logs app --tail=200
docker compose --env-file .env.docker logs adapters --tail=200
```

常见问题：

- `Missing FEISHU_APP_ID / FEISHU_APP_SECRET`：飞书凭据没写入 `/root/.claude/adapters.json`
- `Cannot send ... session not ready`：adapter 无法连上 app WebSocket，优先查鉴权和 `ADAPTER_SERVER_URL`
- `Unauthorized` / `401`：`SERVER_AUTH_TOKEN` 不一致或未注入
- `pairedUsers: 0`：用户还没配对

## Telegram

当前 `docker-compose.yml` 默认只启动飞书 adapter。如果需要 Telegram，可把 `adapters` 服务命令改成：

```yaml
command: ["bun", "run", "desktop/sidecars/claude-sidecar.ts", "adapters", "--telegram"]
```

同时启动飞书和 Telegram：

```yaml
command: ["bun", "run", "desktop/sidecars/claude-sidecar.ts", "adapters", "--feishu", "--telegram"]
```

然后在 Web UI 的 IM 接入页面配置 Telegram Bot Token 并完成配对。

## 健康检查

前端：

```bash
curl http://127.0.0.1:8080/
```

后端：

```bash
docker compose --env-file .env.docker exec web wget -qO- http://app:3456/health
```

预期返回：

```json
{"status":"ok","timestamp":"..."}
```

Compose 配置展开检查：

```bash
docker compose --env-file .env.docker config
```

## 更新部署

拉取代码后：

```bash
git pull
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

依赖或 Dockerfile 变化较大时：

```bash
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
```

## 停止与清理

停止容器：

```bash
docker compose --env-file .env.docker down
```

停止并删除持久化数据：

```bash
docker compose --env-file .env.docker down -v
```

`claude_data` volume 保存 `/root/.claude`，包括服务端配置、IM 配置、配对用户等。执行 `down -v` 会清空这些数据。

清理构建缓存：

```bash
docker builder prune -af
```

## 生产建议

- 只暴露 `web` 服务端口，不要把 `app:3456` 映射到公网。
- `SERVER_AUTH_TOKEN` 使用高强度随机字符串。
- 外层建议接 HTTPS 反向代理，例如 Nginx、Caddy 或 Traefik。
- `CC_HAHA_WORKSPACE_DIR` 指向独立工作区目录，不要直接挂载宿主机根目录。
- 定期备份 Docker volume `claude_data`。
- 不要把 `.env.docker`、`/root/.claude/adapters.json`、日志中的 token 上传到公开仓库。

## 一键流程

```bash
cp .env.example .env.docker

# 编辑 .env.docker

mkdir -p /data/cc-haha/workspace

docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f adapters
```
