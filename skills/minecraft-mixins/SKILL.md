---
name: minecraft-mixins
description: Minecraft Mixin 开发与第三方 mod 补丁：@Mixin/@Inject/@Redirect/@ModifyVariable/@Accessor、mixin 配置、refmap、Forge 1.20.1 MixinGradle 与 manifest MixinConfigs、Fabric 配置差异、InjectionError 排查。用于给 Forge/Fabric 模组写注入、修改第三方 jar 行为、移植 mixin 或排查注入失败。触发词：Mixin、mixin 注入、@Inject、@Redirect、refmap、MixinConfigs、InjectionError、补丁 mod、改第三方 mod、HYW 补丁、TaCZ 补丁。
---

# Minecraft Mixin 开发与补丁

## 0. 适用范围与底线

- 本技能覆盖：自写 Forge/Fabric 模组的 Mixin；给已发布 mod（如 HYW、TaCZ）写独立补丁；排查注入不生效/启动崩溃。
- **先证据后代码**：目标类名、方法名、描述符必须先从 jar 里查出来，禁止凭记忆写。
- **能不用 Mixin 就不用**：官方 API、事件、数据包、KubeJS 能解决的，优先走官方路径。Mixin 适合方法前后注入、调用重定向、字段访问、接口注入；改常量/删指令/改控制流用字节码工具更合适。
- 给第三方 mod 打补丁时，优先做**独立补丁 mod**；直接改原 jar 只作为最后手段，且必须留原 jar 备份与可复现的补丁脚本。

## 1. 目标定位（写 mixin 之前）

1. 列出 jar 内容：`unzip -l target.jar | grep -i mixin`，确认目标类是否存在、是否已带 mixin 配置。
2. 反编译目标类：CFR / Vineflower / Recaf，确认方法体与调用点。
3. 看精确签名：`javap -p -s -classpath target.jar com.example.Target`，记录方法名 + 描述符（重载必须靠描述符区分）。
4. 确认运行端：客户端专用类（`Screen`、`GuiGraphics`、渲染器）必须放 mixin 配置的 `client` 数组；服务端不存在的类不要放 `mixins`。
5. 确认映射：Forge 1.20.1 开发环境是 official（mojmap），生产环境是 SRG；`method`/`target` 字符串按开发名写，refmap 负责生产环境映射。第三方 mod 自身的类/方法通常不混淆，但它内部调用的 MC 方法仍需要 refmap。

常用命令：

```bash
javap -p -s -classpath libs/TargetMod.jar com.example.target.TargetClass
unzip -p TargetMod.jar META-INF/MANIFEST.MF
unzip -p TargetMod.jar META-INF/mods.toml
```

## 2. Forge 1.20.1 接入（实测路径）

### 2.1 推荐：MixinGradle

```groovy
plugins {
    id 'net.minecraftforge.gradle' version '6.0.54'
    id 'org.spongepowered.mixin' version '0.7.+'
}

repositories {
    maven { url = 'https://repo.spongepowered.org/repository/maven-public/' }
    maven { url = 'https://maven.minecraftforge.net/' }
}

dependencies {
    annotationProcessor 'org.spongepowered:mixin:0.8.5:processor'
}

mixin {
    add sourceSets.main, 'mymod.refmap.json'
    config 'mymod.mixins.json'
}
```

- MixinGradle 会把 `config` 写进产物的 `META-INF/MANIFEST.MF` 的 `MixinConfigs` 键（官方 wiki 明示），并生成 refmap；源码里的 mixin 配置**不要手写 `refmap` 字段**，构建时注入。
- 如果 `plugins {}` 解析不到 MixinGradle，在 `settings.gradle` 的 `pluginManagement.repositories` 里也加上 Sponge 仓库。
- 版本按实际发布解析；`0.7.+` 是官方 wiki 的写法，锁定版本时以构建成功为准。

### 2.2 手工 manifest（不使用 MixinGradle）

```groovy
jar {
    manifest {
        attributes 'MixinConfigs': 'mymod.mixins.json'
    }
}
```

- 本地 HYW 0.8 的成品 jar 就是这个形态：`MixinConfigs: hundred_years_war.mixins.json,hundred_years_war.client.mixins.json,freecam.client.mixins.json`（2026-11 对 `_build/tacz12_hyw_patch/HundredYearsWar-...jar` 实测）。
- 手工方案仍需自己解决 refmap（注解处理器），否则开发环境正常、生产环境可能全部注入失败。

### 2.3 不要照抄的写法

- **Forge 1.20.1 的 `mods.toml` 没有 `[[mixins]]` 段**（官方 1.20.1 Mod Files 文档无此项）。不要照抄 NeoForge 1.21+ 的 `[[mixins]]`。
- Fabric 的 `fabric.mod.json` `"mixins": [...]` 只适用于 Fabric（见 §5）。
- 不要把 `refmap` 文件名写死成不存在的文件；构建后检查 jar 里是否真的有该 refmap。

## 3. Mixin 配置

`src/main/resources/mymod.mixins.json`：

```json
{
  "required": true,
  "package": "com.example.mymod.mixin",
  "compatibilityLevel": "JAVA_17",
  "minVersion": "0.8",
  "priority": 1000,
  "mixins": ["TargetMixin"],
  "client": ["ClientTargetMixin"],
  "server": [],
  "injectors": {
    "defaultRequire": 1
  }
}
```

- `compatibilityLevel`：1.20.1 用 `JAVA_17`；1.21.x 用 `JAVA_21`；26.x 用 `JAVA_25`。
- `priority`：默认 1000，**数值越小越先应用**（官方配置文档）。HYW 0.8 用 502 提前介入；和别的 mixin 抢同一注入点时才需要调。
- `defaultRequire: 1`：每个注入点必须命中一次，映射错位时直接报错而不是静默失效。调试期可临时调 0 定位，但**发布前必须改回 1**。
- `required: true`：目标缺失即崩溃；目标 mod 是可选依赖时改用 `@Pseudo` + 配置插件/`required: false` 做降级。
- `plugin`：需要按条件启用/禁用 mixin 时写自定义 `IMixinConfigPlugin`；HYW 0.8 三份配置共用 `HywMixinConfigPlugin`，可作为参考。

## 4. 注解速查

| 注解 | 用途 | 关键点 |
|---|---|---|
| `@Mixin(Target.class)` | 类级声明 | 目标不在编译期时用 `@Mixin(targets = "com.example.Target")` |
| `@Pseudo` | 目标类可能不存在 | 可选依赖/跨 mod 补丁必加，防类缺失崩溃 |
| `@Shadow` | 访问目标字段/方法 | 签名必须与目标一致；final 字段加 `@Shadow @Final` |
| `@Unique` | 声明 mixin 自己的成员 | 避免重名冲突 |
| `@Inject` | 方法前后注入 | `at = @At("HEAD"/"RETURN"/"INVOKE"/"TAIL")`；取消用 `cancellable = true` + `ci.cancel()` |
| `@Redirect` | 替换一次调用/字段访问 | 比 `@Inject` 脆弱，优先 `@Inject` |
| `@ModifyVariable` | 改局部变量/参数 | `at = @At("HEAD")`，用 `ordinal`/`index` 区分 |
| `@ModifyArg` / `@ModifyArgs` | 改调用参数 | 配合 `@At(value = "INVOKE", target = ...)` |
| `@ModifyConstant` | 改常量 | 适合改写死的数值 |
| `@Accessor` / `@Invoker` | 接口式访问私有成员 | interface mixin，方法体为空 |
| `@Overwrite` | 整体覆盖 | 冲突最大，避免；优先 `@Inject` |

处理函数约定：

- `@Inject`：`private`、返回 `void`；参数 = 目标方法参数 + `CallbackInfo`（有返回值时用 `CallbackInfoReturnable<T>`）。返回 void 用 `ci.cancel()`；有返回值用 `cir.setReturnValue(...)`。
- `@Redirect`：参数 = 被替换调用的参数 + 接收者实例（实例调用时），返回类型 = 被替换目标的返回类型。
- 构造器：`method = "<init>"`；`@At("RETURN")` 配 `CallbackInfo`。
- 重载方法必须写描述符，例如 `method = "hurt(Lnet/minecraft/world/damagesource/DamageSource;F)Z"`；`@At` 的 `target` 同样用 `L类;方法名(参数)返回` 描述符。

## 5. Fabric 侧差异

- 配置在 `fabric.mod.json` 的 `"mixins": ["mymod.mixins.json"]`；不再需要 manifest `MixinConfigs`。
- Loom 1.16+ 默认不生成 refmap，mixin 由 Tiny Remapper 就地重映射；老教程的 `refmap` 字段在新工程里不要写。
- 完整配置/注解参考见 `references/mixins.md`（Fabric 视角；注解与注入点部分对 Forge 同样适用，接入差异以本文 §2 为准）。

## 6. 给第三方 mod 写补丁（HYW/TaCZ 类场景）

1. 用 scaffold 建一个 Forge 1.20.1 补丁 mod（安装到其他位置时用 `node "$MCDEV_HOME/mcdev.mjs"`）：

   ```bash
   node ~/.qoder/skills/_minecraft-dev/mcdev.mjs scaffold \
     --platform forge --mc 1.20.1 --dir /d/dev/hyw-patch \
     --name hyw-patch --package com.example.hywpatch
   ```

2. 目标 mod 放 `libs/`，`compileOnly files('libs/HundredYearsWar-....jar')`；**不要把目标 jar 打进产物**。目标类不在编译期时用 `@Mixin(targets = "...")` + `@Shadow` 只声明需要的成员。
3. 目标 mod 作为 `mandatory` 依赖写进 `mods.toml`（补丁没目标就没意义）；目标可选时用 `optional = true` + `@Pseudo` + 降级逻辑。
4. 只注入必要的方法；先用 `@Inject` 在 `HEAD`/`RETURN` 做前置/后置，必须改返回值时用 `@Inject` + `CallbackInfoReturnable`，尽量不用 `@Redirect`（会和渲染/战斗类 mod 的 redirect 冲突）。
5. 构建后检查产物：

   ```bash
   unzip -p build/libs/hyw-patch-0.1.0.jar META-INF/MANIFEST.MF
   unzip -l build/libs/hyw-patch-0.1.0.jar | grep -i mixin
   ```

6. 直接改原 jar 的场景（Mixin 表达不了）：备份原 jar → 记录 SHA-1 → 用 ASM/Recaf 做最小字节码修改 → `javap -c -p` 复核 → 把补丁步骤写成可重跑脚本（参考 `_build/tacz12_hyw_patch/apply_patch.py` 的模式）。产物必须保留原 manifest 的 `MixinConfigs`，否则原 mod 自己的 mixin 会全部失效。

## 7. 调试与排查

启动参数（客户端/服务端都适用）：

```
-Dmixin.debug.verbose=true
-Dmixin.debug.export=true        # 导出应用后的类到 .mixin.out/class
-Dmixin.debug.countInjections=true
-Dmixin.checks.interfaces=true
```

| 现象 | 优先检查 |
|---|---|
| `InjectionError: ... has no method matching ...` | 方法名/描述符错；official 名与 SRG 名混用；重载没写描述符 |
| `target class ... was not found` | `targets` 类名拼错；目标类不在当前端；目标 mod 没加载 |
| 开发环境正常、生产环境全失效 | refmap 缺失/未生成；manifest 没有 `MixinConfigs`；映射版本不匹配 |
| 注入点静默不生效 | `defaultRequire` 被设成 0；`@At` target 描述符不匹配；mixin 配置类名/包名写错 |
| 启动报 redirect 冲突 | 两个 mixin 抢同一调用；调 `priority`（越小越先）或改用 `@Inject` |
| 客户端渲染异常 | 渲染 mod（Embeddium/Oculus 等）也改同一调用；在目标整合包客户端里实测，不要只看 dev 环境 |
| 服务端崩、客户端正常 | 客户端专用类放进了 `mixins` 而不是 `client`；`@Shadow` 了仅客户端存在的成员 |

日志关键词：`Mixing`, `Mixin apply`, `InjectionError`, `Critical injection failure`, `refmap`, `InvalidInjectionException`。日志在 `logs/latest.log`（或整合包实例的 `logs/`）。

## 8. 发布前验收

- [ ] `javap` 复核目标签名与描述符；`@Shadow` 类型/名称一致。
- [ ] 配置的 `mixins`/`client`/`server` 分端正确；`defaultRequire` 已改回 1。
- [ ] 产物 manifest 有 `MixinConfigs`；Forge 产物内有 refmap（若使用 MixinGradle）。
- [ ] 在**目标整合包的实际客户端/服务端**启动一次（本项目规则：客户端 mixin 改动后重启隔离客户端，不要用主客户端）。
- [ ] 日志无注入错误；目标行为已实测；调试参数未带进发布配置。
- [ ] 直接改过的原 jar 有备份、SHA-1 记录和可重跑补丁脚本。

## 9. 参考

- `references/mixins.md`：Mixin 配置、@Inject/@Redirect/@Shadow/@Accessor、Fabric 接入与 refmap 变化（注解部分通用）。
- SpongePowered Mixin Wiki「Mixins on Minecraft Forge」：MixinGradle + `MixinConfigs` manifest 的官方说明。
- 本地成品参照：`_build/tacz12_hyw_patch/HundredYearsWar-0.8.0r-1.20.1-forge-tacz12.jar`（manifest `MixinConfigs`、三份配置、`priority: 502`、`HywMixinConfigPlugin`）。
