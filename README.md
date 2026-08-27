<h1 align="center">OpenHuman 中文社区版</h1>
<p align="center">
 <strong>中文国内环境的主动智能体平台：通过多通道整合让Agent了解你的一切，无障碍辅助你生活的方方面面。</strong>
</p>

<p align="center">
 <strong>维护者：<a href="https://github.com/Oii6111">@Oii6111</a></strong> ｜ 欢迎 issue、PR 与反馈
</p>

<p align="center">
 <img src="https://img.shields.io/badge/status-early%20beta-orange" alt="早期测试版" />
 <a href="./LICENSE"><img src="https://img.shields.io/github/license/tinyhumansai/openhuman" alt="许可证" /></a>
</p>

> **早期测试版**：中文社区版仍在快速迭代中，部分功能还不够完善，欢迎反馈与参与。
>
> 本项目基于 [tinyhumansai/openhuman](https://github.com/tinyhumansai/openhuman)（GPL-3.0）二次开发，持续跟随上游同步，并在其之上增加面向中文用户与国内生态的适配。完整的上游功能中文介绍见 [docs/README.zh-CN.md](./docs/README.zh-CN.md)。

## 这是什么

OpenHuman 是一个开源的个人 AI 超级智能平台，大多数 AI 助手缺的三样东西，它都补上了：

- **长期记忆**：把你所有的文档、邮件、聊天记录和代码仓库压缩成本地的记忆树，智能体越用越懂你，而不是每次从零开始。
- **任务规划**：后台持续运转的智能体编排，主动追踪信息变化，按定时任务和事件触发工作流，把复杂任务拆给多个专职智能体并行推进。
- **深度研究**：在你把问题说完之前，就已经扫遍你的数据和整个网络。

它和普通 AI 助手的最大区别是**主动**：上百个应用连接器、数万个现成技能，自动把邮件、日历、文档、代码仓库、聊天记录等信息拉取到本地，压缩成持续增长的知识树；即使没有指令，也会基于对业务的理解主动给出提醒和建议。

## 中文社区版做了什么

### 已实现

- **界面汉化**：简体中文界面，支持自动检测系统语言，中文用户开箱即用。
- **文档本地化**：完整的中文 README 与项目文档。
- **合规声明**：保留上游版权，新增 [NOTICE](./NOTICE) 说明代码来源与修改内容。
- **个人微信通道（目前唯一已落地的国内通道）**：
  基于腾讯官方 iLink 协议，Rust 原生实现，不依赖 Node 侧车或 WebView 模拟。
  当前已支持：
  - 扫码登录（官方二维码流程）
  - 文本消息收发
  - 正在输入（typing）状态
  - 配置持久化与多会话上下文
  - 定时提醒等 Agent 主动消息下发

  尚未支持：图片、视频、文件、语音等媒体消息（作为下一步开发方向）。

### 规划中 / 未实现

以下列项目前**尚未实现**，仅作为社区方向公开列出，欢迎通过 issue 或 PR 参与：

- 企业微信通道
- 飞书、钉钉、QQ 等国内消息通道的完善
- 微博、贴吧、知乎等社交平台接入
- 国产可穿戴 AI 设备（AI 眼镜、AI 运动相机、智能手表/手环等）
- 垂类领域开箱即用的由领域专业人员调教的包

## 快速开始

**安装桌面版**：暂无，目前请使用上游的安装包——从 [tinyhumans.ai/openhuman](https://tinyhumans.ai/openhuman?utm_source=github&utm_medium=readme) 或 [GitHub Releases](https://github.com/tinyhumansai/openhuman/releases/latest) 下载。命令行安装（Homebrew、Debian/Ubuntu `.deb`、AUR 等）见 [INSTALL.md](./INSTALL.md)。

**从源码构建**：

```bash
git clone https://github.com/Oii6111/openhuman-zh.git
cd openhuman-zh
git submodule update --init --recursive
pnpm install
pnpm dev          # 纯 Web UI 开发
pnpm dev:app      # 完整 Tauri 桌面开发（MacOS）
pnpm dev:app:win  # 完整 Tauri 桌面开发（windows）
```

构建环境要求：Git、Node.js 24+、pnpm 10.10.0、Rust 1.93.0（`rustfmt` + `clippy`）、CMake、Ninja、ripgrep，以及各平台桌面构建所需的前置依赖。

## 与上游的关系

- **上游项目**：[tinyhumansai/openhuman](https://github.com/tinyhumansai/openhuman)（约 3.7 万 stars，GPL-3.0）
- **同步策略**：本仓库持续从上游合并最新代码，尽可能保持与官方更新速度一致。
- **回馈上游**：通用性强的改进（翻译、Bug 修复、通用功能、国内生态渠道）会以 issue/PR 的形式回馈上游；国内特有适配保留在本社区版。

## 参与贡献

新贡献者可以先看上游的 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解 fork/PR 流程和本地验证命令。中文社区版特别欢迎以下贡献：

- 界面与文档的中文翻译修正
- 国内通道（微信、飞书、钉钉、QQ 等）的适配
- 国内大模型、数据源与 MCP 服务器的接入
- 各类垂直领域开箱即用包

## 许可

本项目基于 [GPL-3.0](./LICENSE) 许可分发。代码来源与修改说明见 [NOTICE](./NOTICE)，上游版权归 tinyhumansai 与 OpenHuman Contributors 所有。
