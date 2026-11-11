# minecraft-skill-dev-agent-auto

可移植的 Minecraft Java 开发技能包（Qoder 适配版），面向 **Forge 1.20.1 模组 / 附属 / Mixin 补丁**，同时保留跨版本构建知识。

改编自 [sikadi233-hub/minecraft-dev](https://github.com/sikadi233-hub/minecraft-dev)（Apache-2.0）。原项目是 DeepSeek Harness 插件；本仓库把其中可移植的技能、离线 API 索引与脚手架/构建引擎抽出来，补上了 Qoder 的 `SKILL.md` frontmatter、工具名映射，并新增了一个独立的 Mixin 技能。

## 包含内容

| 路径 | 内容 |
|---|---|
| `skills/minecraft-forge-mod` | Forge 1.7.10 / 1.12.2 / 1.16.5 / 1.20.1 开发、FG 版本配对、mods.toml、reobfJar、runData；含 1.20.1 Forge 47.3.0 离线 API 签名索引（344 类） |
| `skills/minecraft-java-build` | JDK / Gradle / wrapper / foojay / 依赖仓库 / 离线构建与常见构建失败排查 |
| `skills/minecraft-major-mods` | 28 个大型模组的 modid、curse.maven/Modrinth 坐标、软依赖写法与扩展点（1.7.10 / 1.12.2 / 1.20.1 / 1.21.1+） |
| `skills/minecraft-mixins` | `@Mixin/@Inject/@Redirect/@Shadow/@Accessor`、mixin 配置、refmap、Forge 1.20.1 MixinGradle、manifest `MixinConfigs`、InjectionError 排查、第三方 mod 补丁流程 |
| `runtime/` | 共享运行时：`mcdev.mjs` + `lib/` + 14 套平台/版本 Gradle 工程模板（Paper / Fabric / Forge / NeoForge / Spigot） |

## 安装

需要 Node.js ≥ 18。

```bash
git clone https://github.com/fazeming486-alt/minecraft-skill-dev-agent-auto.git
node minecraft-skill-dev-agent-auto/install.mjs
```

默认安装到 `~/.qoder/skills`。Qoder 用户重启会话或执行 `/skills reload` 后生效。

其他 agent / 其他目录：

```bash
node install.mjs --target ~/.claude/skills --force
export MCDEV_HOME="$HOME/.claude/skills/_minecraft-dev"
node "$MCDEV_HOME/mcdev.mjs" platforms
```

`--force` 会覆盖同名技能目录；不加时跳过已存在的目录。`--list` 只列出将要安装的内容。

## CLI

```bash
# 查看支持的平台线
node ~/.qoder/skills/_minecraft-dev/mcdev.mjs platforms

# 新建 Forge 1.20.1 工程
node ~/.qoder/skills/_minecraft-dev/mcdev.mjs scaffold \
  --platform forge --mc 1.20.1 \
  --dir /d/dev/my-mod --name my-mod --package com.example.mymod

# 构建（自动处理 Windows cmd 引号、超时杀进程树、输出头尾截断）
node ~/.qoder/skills/_minecraft-dev/mcdev.mjs gradle \
  --dir /d/dev/my-mod --task build
```

平台线：Paper `1.20/1.21/26.x`、Fabric `1.20/1.21/26.x`、Forge `1.7.10/1.12.2/1.16.5/1.20.1`、NeoForge `1.20.1/1.21.1/1.21.x/26.x`、Spigot `1.7.10/1.12.2`。共 14 套模板。

## 环境要求与坑

- MC 1.7.10 / 1.12.2 / 1.16.5 编译需要 JDK 8；1.20.1 需要 JDK 17；1.21.x 需要 JDK 21；26.x 需要 JDK 25。
- **Gradle 启动 JVM 与编译 toolchain 是两回事**：1.20.1 的 Gradle 8.8 自身需要 JVM 17+，foojay 只负责编译 toolchain。
- Windows / Git Bash 示例（路径按自己的机器替换）：
  ```bash
  export JAVA_HOME="C:/Users/<you>/AppData/Roaming/.minecraft/runtime/java-runtime-beta"
  ```
- 老线首次构建要下载 MCP / 反编译数据，可能 30 分钟以上；不是卡死。
- 本地整合包附属优先 `compileOnly files('libs/xxx.jar')`，产物不要打包目标 mod 本体。

## 已验证

- 14 套模板全部成功 scaffold，生成的文本文件无未解析 `{{...}}` 占位符。
- 生成工程的 Gradle 8.8 wrapper 可启动（JDK 17 实测）。
- `mcdev.mjs gradle --task --version` 与超时/输出截断路径实测。
- 修复了上游模板的一个问题：项目名是 kebab-case，但原先直接用作 Forge/NeoForge 的 `modId`；官方要求 `^[a-z][a-z0-9_]{1,63}$`，现已改为下划线变体（如 `my-mod` → `my_mod`），显示名与 jar 名仍保留连字符。
- 完整 ForgeGradle 配置在本机未通过：`net.minecraftforge:forge:1.20.1-47.3.0:userdev` 解析失败（`maven.minecraftforge.net` 不可达/镜像缺工件），不是模板语法错误；已有离线 MDK 可复用 `localrepo/`。模板与构建脚本来自上游已真机构建过的版本。

## 来源与许可

- 上游：[sikadi233-hub/minecraft-dev](https://github.com/sikadi233-hub/minecraft-dev)，Apache-2.0。
- 本仓库保留了上游 `LICENSE` 与 `NOTICE`；每个技能目录也带有 `NOTICE`。
- 修改内容：Qoder frontmatter、工具名适配（Read/Grep/WebSearch/AskUserQuestion）、`mcdev.mjs` CLI 移植、`modId` 清洗、新增 `minecraft-mixins` 技能与 Forge 1.20.1 Mixin 接入说明、本 README 与安装脚本。
