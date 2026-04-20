# Docker 打包与部署指南

本文档说明如何将 `cc-haha` 打包为 Docker 镜像，并以 `docker compose` 方式部署成可访问的 Web UI 服务。

## 部署目标

当前仓库的 Docker 方案针对的是：

- Bun 服务端
- `desktop/` 构建出的 Web UI 静态资源
- Nginx 反向代理 `/api`、`/proxy`、`/ws`

不针对的是：

- Tauri 桌面安装包
- macOS / Windows 原生桌面端分发

如果你的目标是“浏览器访问 + 远程使用”，请使用本文档方案。

## 架构说明

容器编排由根目录 [docker-compose.yml](/Users/hsguo/Documents/workcode/github/aicode/cc-haha/docker-compose.yml:1) 定义，共两个服务：

- `app`
  运行 Bun 服务端，监听容器内 `3456`
- `web`
  运行 Nginx，提供前端静态文件，并将 `/api`、`/proxy`、`/ws` 转发给 `app`

相关文件：

- [Dockerfile.server](/Users/hsguo/Documents/workcode/github/aicode/cc-haha/Dockerfile.server:1)
- [Dockerfile.web](/Users/hsguo/Documents/workcode/github/aicode/cc-haha/Dockerfile.web:1)
- [docker/nginx.conf.template](/Users/hsguo/Documents/workcode/github/aicode/cc-haha/docker/nginx.conf.template:1)

## 前置要求

- 已安装 Docker
- 已安装 Docker Compose Plugin
- 目标机器能够访问你的模型供应商 API
- 准备一个宿主机目录用于挂载工作区

可用命令检查：

```bash
docker --version
docker compose version
```

## 为什么镜像里不使用 `bun.lock`

这个仓库里历史 `bun.lock` 记录过 `npmmirror` 的 tarball 地址。部分地址已经失效，容易在镜像构建阶段触发如下错误：

```text
bun install --frozen-lockfile
GET https://cdn.npmmirror.com/... - 404
ConnectionRefused downloading tarball
```

因此当前 Dockerfile 采用的是：

- 构建镜像时只复制 `package.json`
- 容器内重新执行 `bun install`
- 通过 `NPM_CONFIG_REGISTRY` 指定依赖仓库

默认 registry 为：

```text
https://registry.npmjs.org/
```

## 推荐的环境文件

建议单独创建一个部署环境文件，例如根目录 `.env.docker`，不要直接复用开发态 `.env`。

示例：

```env
# 反向代理注入到 Bun server 的 Bearer Token
SERVER_AUTH_TOKEN=change-me-to-a-random-secret

# 对外暴露的 Web 端口
CC_HAHA_HTTP_PORT=8080

# 宿主机工作区，容器内会挂载到 /workspace
CC_HAHA_WORKSPACE_DIR=/data/cc-haha/workspace

# 时区
TZ=Asia/Shanghai

# Bun 安装依赖时使用的 npm registry
NPM_CONFIG_REGISTRY=https://registry.npmjs.org/

# 模型供应商配置，二选一
ANTHROPIC_API_KEY=your-api-key
# ANTHROPIC_AUTH_TOKEN=your-auth-token

# 兼容 Anthropic 的第三方端点示例
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

如果使用 Anthropic 官方，也可以只配置：

```env
ANTHROPIC_API_KEY=sk-ant-xxx
```

## 目录准备

先创建工作区目录：

```bash
mkdir -p /data/cc-haha/workspace
```

然后在仓库根目录创建部署环境文件：

```bash
cp .env.example .env.docker
```

再手动编辑 `.env.docker`，把上面的示例值填进去。

说明：

- `docker compose` 读取的是 Compose 环境变量，不会自动把 `.env.docker` 注入应用
- 应用运行时所需变量，已经在 `docker-compose.yml` 里映射到了容器环境

## 构建镜像

在仓库根目录执行：

```bash
docker compose --env-file .env.docker build --no-cache
```

如果你只想单独构建后端：

```bash
docker compose --env-file .env.docker build app --no-cache
```

如果你只想单独构建前端：

```bash
docker compose --env-file .env.docker build web --no-cache
```

## 启动服务

```bash
docker compose --env-file .env.docker up -d
```

查看服务状态：

```bash
docker compose --env-file .env.docker ps
```

查看日志：

```bash
docker compose --env-file .env.docker logs -f
```

## 访问方式

启动成功后，浏览器访问：

```text
http://<服务器IP>:8080
```

如果你修改了 `CC_HAHA_HTTP_PORT`，请替换成对应端口。

## 首次使用说明

Web UI 创建会话时，需要选择一个容器内存在的目录。

由于宿主机目录被挂载到了容器内 `/workspace`，所以你应该在 UI 中选择类似：

```text
/workspace
/workspace/my-project
```

而不是宿主机原始路径，例如：

```text
/data/cc-haha/workspace/my-project
```

## 健康检查与验证

验证前端是否可访问：

```bash
curl http://127.0.0.1:8080/
```

验证后端健康检查：

```bash
docker compose --env-file .env.docker exec web wget -qO- http://app:3456/health
```

预期返回：

```json
{"status":"ok","timestamp":"..."}
```

## 更新部署

拉取代码更新后，重新构建并重启：

```bash
git pull
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

如果你怀疑依赖缓存有问题：

```bash
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
```

## 停止与清理

停止服务：

```bash
docker compose --env-file .env.docker down
```

停止并删除数据卷：

```bash
docker compose --env-file .env.docker down -v
```

说明：

- `claude_data` volume 中保存的是容器内 `/root/.claude`
- 删除 volume 会清空相关持久化数据

## 生产环境建议

- 用专门的 `.env.docker` 管理部署变量，不要混用开发 `.env`
- `SERVER_AUTH_TOKEN` 使用高强度随机字符串
- 外网部署时，建议在最外层再接一层 HTTPS 反向代理，例如 Nginx 或 Traefik
- 将 `CC_HAHA_WORKSPACE_DIR` 指向一个权限清晰、独立隔离的目录
- 只暴露 `web` 服务端口，不要把 `app:3456` 直接映射到公网

## 常见问题

### 1. `bun install` 时报 `npmmirror` 404 或 tarball 下载失败

原因：

- 历史锁文件中的 tarball 地址失效

处理：

- 使用当前 Dockerfile 的默认行为重新解析依赖
- 在 `.env.docker` 中显式指定：

```env
NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
```

然后重新构建：

```bash
docker compose --env-file .env.docker build --no-cache
```

### 2. 浏览器能打开页面，但创建会话失败

常见原因：

- 你选择了宿主机路径，而不是容器内路径
- 挂载目录没有准备好

处理：

- 确认 `CC_HAHA_WORKSPACE_DIR` 已正确映射
- 在 UI 中使用 `/workspace/...` 路径

### 3. 页面能打开，但接口 401

原因：

- `SERVER_AUTH_TOKEN` 没有正确传给 `web` 和 `app`
- 你修改了 Nginx 配置但没有重建

处理：

```bash
docker compose --env-file .env.docker config
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
```

### 4. 模型调用失败

原因通常是：

- `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN` 不正确
- `ANTHROPIC_BASE_URL` 配错
- 模型名与供应商实际支持的不一致

建议先检查：

```bash
docker compose --env-file .env.docker logs -f app
```

### 5. 想部署桌面端而不是 Web UI

Docker 不适合承载 Tauri 桌面安装包分发。

如果你要的是：

- macOS `.dmg`
- Windows `.exe`

请继续使用 `desktop/` 原本的本地构建流程，而不是本文档。

## 一键流程总结

```bash
cp .env.example .env.docker

# 编辑 .env.docker

mkdir -p /data/cc-haha/workspace

docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f
```
