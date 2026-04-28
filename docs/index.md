---
layout: home

hero:
  name: AgentCode
  text: 本地可运行的 agent-code 工程化版本
  tagline: 基于 agent-code 泄露源码修复，支持任意 Anthropic 兼容 API、桌面端、Docker Web、Computer Use、Telegram / 飞书远程驱动
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: Docker 部署
      link: /guide/docker-deployment
    - theme: alt
      text: GitHub
      link: https://github.com/NanmiCoder/cc-haha

features:
  - title: 本地可运行
    details: 修复原始源码中的运行问题，保留完整 Ink TUI，并支持 --print 无头模式。
  - title: 任意 Anthropic 兼容 API
    details: 可接入 MiniMax、OpenRouter、LiteLLM、DeepSeek 代理、Ollama 代理等兼容服务。
    link: /guide/third-party-models
  - title: 图形化桌面端
    details: 基于 Tauri 2 + React，支持多标签、多会话、项目管理、模型切换、权限控制和 Diff 展示。
    link: /desktop/
  - title: Docker Web 版
    details: 支持浏览器访问、密码鉴权、非 root 用户运行、独立 workspace 和远程部署。
    link: /guide/docker-deployment
  - title: Computer Use
    details: 支持桌面截图、鼠标、键盘等自动化能力，覆盖 macOS / Windows 场景。
    link: /features/computer-use
  - title: Telegram / 飞书远程驱动
    details: 通过 IM 发起任务、继续会话、远程审批权限并接收执行结果。
    link: /im/
  - title: MCP / Skills / 多 Agent
    details: 保留并扩展 MCP、Skills、子代理、多 Agent 编排和 Teams 协作能力。
    link: /agent/
  - title: 项目与工作区
    details: Web UI 支持在 /workspace 下创建项目，并在配置目录中维护项目注册信息。
---

## 项目定位

AgentCode 是一个基于 agent-code 泄露源码修复的本地可运行版本。它的目标是把原本只能在特定官方环境中工作的 CLI，整理成一个可本地部署、可服务器运行、可图形化使用、可远程驱动、可接入多家模型供应商的工程化项目。

你可以用它：

- 在本机运行完整 TUI coding agent。
- 在服务器上部署 Web 版，通过浏览器远程使用。
- 接入 MiniMax、OpenRouter、火山方舟、LiteLLM 等 Anthropic 兼容接口。
- 使用桌面端管理多个项目、会话、模型和权限。
- 通过 Telegram / 飞书从手机或团队群里驱动 Agent。
- 研究 agent-code 的工具系统、权限系统、MCP、Skills 和多 Agent 架构。

## 推荐阅读

- [快速开始](/guide/quick-start)
- [环境变量说明](/guide/env-vars)
- [Docker 部署指南](/guide/docker-deployment)
- [第三方模型接入](/guide/third-party-models)
- [桌面端文档](/desktop/)
- [Computer Use](/features/computer-use)
- [Telegram / 飞书配置](/im/)
- [多 Agent 系统](/agent/)
- [Skills 系统](/skills/01-usage-guide)
- [记忆系统](/memory/01-usage-guide)
