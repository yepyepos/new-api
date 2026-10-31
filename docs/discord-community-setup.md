# Discord 社区登录版 New API

## 这次修改的范围

本目录基于 2026-10-30 拉取的官方 `QuantumNous/new-api` 主分支，基准提交为 `a2defd2a8256abe039e5295bd583aeb2d02f111f`。功能版本位于 `codex/discord-community` 分支。开发者本机路径和缓存不是部署依赖。

这是网站侧的社区准入功能，不是政府身份证实名验证，也不是 Discord 聊天机器人。即使你不是目标社区管理员，用户本人通过 Discord 授权后，也可以查询其在指定社区的成员资料和身份组。

源码仓库不包含站点数据库、真实 Discord 凭据或本机测试缓存。用户此前已在本机验证 Discord 登录与签到；这不代替正式部署后的多账号准入验收。

## 功能和边界

- 支持指定一个 Discord 服务器；用户必须是该服务器成员。
- 身份组可选。不填则仅检查成员资格；填写多个身份组 ID 时，可切换“任意匹配”或“全部匹配”。`@everyone` 的角色 ID 等于服务器 ID，代表所有成员。
- 未完成服务器入群规则确认的成员会被拒绝。
- 可开启“普通用户仅允许 Discord 登录”，服务端同时阻止普通用户使用密码、独立 Passkey、其他 OAuth、微信及尚未完成的其他登录验证流程绕过限制。Discord 主登录之后原有的两步验证仍保留。
- 管理员和超级管理员保留原有、已启用的登录方式，避免社区配置错误导致后台无法进入。管理员选择 Discord 登录时，仍会执行社区校验。
- Discord 登录、绑定 Discord 账号、使用 Discord 完成安全验证时都会检查社区资格。不符合条件时，不返回可用于注册或登录的 Discord 身份。
- Discord 配置沿用 New API 原有设置存储，不保存用户的 Discord 访问令牌或刷新令牌。注册准入新增 `registration_invites`、`registration_admissions`、`registration_batches` 三张表，启动时自动迁移；升级前应备份数据库。
- 注册邀请码可设置名称、使用人数、有效期及是否免服务器/身份组检查。邀请码只在创建时显示一次，数据库保存哈希，注册成功才消费名额。免审资格随后续登录保留，但不能绕过 Discord 身份确认和服务器黑名单。
- 普通注册批次可限制成功注册人数，满额后拒绝普通注册；邀请码注册不占用此批次，管理员新建账号也不计入。重新开放下一批时应明确重置计数。
- 签到每日一次，机会不跨天累计；余额高于门槛时不消耗当天机会，余额等于门槛时允许领取。成功领取全额奖励，即使领取后超过门槛。后台的奖励和门槛输入单位为 USD，程序换算为内部额度，不应手动修改全站额度换算比例。
- 指定黑名单服务器中的成员不能通过 Discord 注册或重新登录；免审邀请码不能绕过。签到及已建立的会话不额外查询 Discord。
- **不是持续授权系统**：退群、角色被撤销、切换限制设置，不会自动注销已有会话，也不会立即停用已发放的 API Key。不会删除账号、余额、历史记录。如需要退群后停用旧 Key，还需单独实现持续检查和 API 请求入口的资格控制。
- 所有新限制默认关闭。若关闭“仅 Discord 登录”，其他已启用登录方式仍可使用；此时社区限制仅作用于 Discord 流程，不能作为全站准入保证。

## 配置方法

### 1. 准备自己的 Discord 应用

进入 [Discord Developer Portal](https://discord.com/developers/applications)，创建属于你的应用。无需安装机器人，也无需目标社区的管理员授权。

应用的 Client ID 是公开标识；Client Secret 是应用密钥，只填在 New API 管理后台，不要发到群里、聊天记录或代码仓库。

在 Discord 应用 OAuth2 设置中登记回调 URL，例如：

```text
https://你的站点域名/oauth/discord
```

### 2. 配置站点地址和安全连接

New API 管理后台的站点地址 `ServerAddress` 应与实际访问地址一致，例如 `https://api.example.com`。本站前端、后台和 Discord 登记的回调必须使用同一站点域名，不要混用 IP、不同子域名或不同端口。

生产环境必须使用 HTTPS，并按上游原有会话安全设置配置：

```text
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://api.example.com
```

这些是部署环境变量，不是普通管理后台设置。仅本机 HTTP 测试时可使用非安全 Cookie；不要把本机测试方式照搬到公网。

### 3. 设置服务器和身份组

在后台“系统设置 -> 身份验证 -> OAuth 集成 -> Discord”中配置：

| 设置 | 配置键 | 说明 |
| --- | --- | --- |
| Discord 授权登录 | `discord.enabled` | 开启 Discord 登录 |
| Client ID | `discord.client_id` | 自己创建的 Discord 应用 ID |
| Client Secret | `discord.client_secret` | 应用密钥，不公开 |
| 指定 Discord 服务器 ID | `discord.guild_id` | 纯数字 ID，不是邀请链接；留空会关闭成员校验 |
| 允许的身份组 ID | `discord.role_ids` | 可留空；多个用英文逗号分隔，按匹配方式判断 |
| 身份组匹配方式 | `discord.role_match_mode` | `any` 为任意匹配，`all` 为全部匹配 |
| 黑名单服务器 ID | `discord.blocked_guild_ids` | 多个 ID 用逗号或换行分隔；优先于邀请码免审 |
| 普通用户仅允许 Discord 登录 | `discord.only_login` | 社区专用站建议开启；管理员原有登录不受该开关限制 |

Discord 开启“开发者模式”后，可通过服务器右键菜单复制服务器 ID。身份组也应使用 ID，而不是会改名的身份组名称；如果你的客户端无法复制身份组 ID，可请社区管理员提供该 ID，不需要索取管理员权限。

表单会先保存凭据、服务器等前置配置，再开启限制。取消配置时，先取消“仅 Discord 登录”，清空身份组，再清空服务器或关闭 Discord 登录。服务器未填写却设置身份组、无效数字 ID、未配置 Discord 就开启仅 Discord 登录等情况会被拒绝。

不要为了让普通用户走 Discord 而关闭全站“密码登录”开关，否则管理员自己的密码入口也会被关闭。使用新增的“普通用户仅允许 Discord 登录”即可。

若将来导入已有用户，请先让他们绑定自己的 Discord 账号，再开启限制；不会按同名用户名自动合并账号或转移余额。

### 4. 使用修改后的程序

必须构建本目录的前端和后端，或从本目录构建自己的 Docker 镜像。直接运行上游官方镜像不会包含本次修改。

```powershell
cd D:\codex\newapi\web
bun install --frozen-lockfile
bun run build
cd ..
go build -o new-api.exe .
```

项目本身要求 Go 版本以 `go.mod` 为准，Bun 版本以 `web/package.json` 为准。也可使用项目原有 Dockerfile：

```powershell
docker build -t new-api-discord:local .
```

这只构建镜像，不会自动部署、配置数据库、绑定域名或创建 Discord 应用。

## 授权页会显示什么

没有配置服务器或黑名单时，仅申请 `identify`，用于读取 Discord 账号基本身份资料。配置目标服务器后增加 `guilds.members.read`，用于查询成员和身份组。设置黑名单服务器时额外申请 `guilds`，分页查询用户所在的服务器以排除黑名单。

不申请邮箱、自动入群、消息内容或机器人管理员权限。Discord 控制授权页的具体文字和外观，网站不能随意改成别的权限说明。这个授权页不是身份证实名验证。

## 公益站部署

在部署环境中设置 `PUBLIC_BENEFIT_MODE=true` 后重启，启用服务器端公益策略。仅上传源码或使用官方预编译镜像不会自动开启此模式；需要从本分支构建，并传入环境变量。

- 关闭充值、付费套餐、额度兑换码、推广链接与返利以及相关管理入口；直接请求对应接口也会被拒绝。
- 保留 Discord 注册与登录、准入邀请码、注册名额、签到、额度使用和日志。不要把注册邀请码与额度兑换码混淆。
- 钱包替换为“额度中心”，访问路径仍为 `/wallet`；历史账户、余额、设置和记录不删除。
- 金额显示用于衡量内部用量，不代表本站开放付费。模型成本和消耗检查仍然生效。
- 精确签到门槛建议保持默认 `BATCH_UPDATE_ENABLED=false`。若启用 Redis 加批量额度落库，数据库余额可能短暂滞后，用户消费到门槛内后可能需等同步才能签到。
- 环境变量未开启时保留原项目收费功能；生产 HTTPS 和安全 Cookie 设置仍然必须正确配置。

## 安全设计

- 所有成员和角色判定均在后端执行；前端隐藏按钮不充当权限检查。
- 授权码流程采用 PKCE S256，即给每次登录增加一份配对凭据，避免被截获的授权码直接拿来登录。Discord 官方授权服务器元数据声明支持 S256。
- 每次 Discord 授权绑定发起浏览器的 HttpOnly、SameSite=Lax Cookie；启用生产安全配置时 Cookie 仅通过 HTTPS 发送。Cookie 中的随机值同时作为 PKCE verifier，数据库流程载荷只保存其 SHA-256 摘要，不保存原文。
- 授权 URL 由后端生成，浏览器不会收到应用密钥或 PKCE verifier 的 JSON 数据。每个流程使用独立 Cookie，多个标签页不会覆盖同一个浏览器绑定。
- 保留上游流程的到期、一次性消费、账号绑定二次验证和会话版本控制；新“仅 Discord 登录”策略在签发会话及完成登录二次验证时重新检查。
- Discord 超时、限流、无成员资格和缺少身份组分别返回安全提示；接口不可用时拒绝本次 Discord 登录，不删除用户或余额。
- 旧版本发起但尚未完成的 Discord 登录不带新的浏览器绑定，升级后应重新点击 Discord 登录。

本次参考了 OWASP ASVS 最新稳定版 `v5.0.0_release` 的认证、会话与 OAuth 相关方向，以及以下指南中的服务端控制、最小权限、CSRF、PKCE、一次性流程和凭据保护要求；这不代表整站已完成 ASVS 合规认证或全面安全审计。

- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)
- [Discord 授权服务器元数据](https://discord.com/.well-known/oauth-authorization-server)
- [当前用户的指定服务器成员资料](https://docs.discord.com/developers/resources/user#get-current-user-guild-member)

## 上线前验收

准备目标服务器内外的测试账号，验证：

1. 非群成员登录失败，不创建可用站内账号。
2. 群成员在未限制身份组时可登录；限制身份组时，按“任意匹配”或“全部匹配”分别验证成功和拒绝。
3. 未完成入群规则确认时无法登录。
4. 开启仅 Discord 登录后，普通用户不能用其他登录方式绕过；管理员仍能使用原有登录方式。
5. 在其他浏览器使用回调、重复使用授权流程或使用过期流程会失败。
6. Discord 故障不会清空余额、删号或破坏管理员登录。
7. 退出服务器后，重新 Discord 登录失败；已有会话和旧 API Key 不会立即停用，这是本版明确的功能边界。
8. 免审邀请码可跳过目标服务器和身份组要求，不能绕过黑名单；已有账号不能用另一个邀请码升级为免审。
9. 普通注册满额后关闭，邀请注册仍可进行；邀请码满额、过期或禁用后拒绝新注册，失败注册不消耗名额。
10. 余额高于门槛拒绝签到，降低余额后同日仍可领取；成功领取每天只有一次，奖励超过门槛时不截断。

真实 Discord 登录仍需配置你自己的应用、域名和服务器 ID 后联调。无需把 Client Secret 或上游 API Key 发给开发助手。

## 本机验证记录

验证环境：Windows、Go 1.27.1、Bun 1.4.4。早期认证测试仅使用 SQLite；随后社区注册/签到数据库矩阵已在 SQLite 3.50.4、MySQL 8.4.13、PostgreSQL 18.4 通过新库及升级验证，包含重复迁移、索引、事务回滚及邀请码/签到并发。该历史结果不代表最低支持版本或 Redis 批量额度模式已完成实测。

- `go test ./oauth ./service ./controller ./setting/system_setting -count=1 -timeout 5m`：四个相关包全部通过，包括 Discord 成员/角色判定、网络和授权失败、PKCE、浏览器绑定、重放、其他登录方式拦截、管理员豁免、已有登录验证流程拦截等用例。
- 前端四个相关测试文件：31 个测试通过，覆盖权限申请、使用服务端授权 URL、缺少授权 URL 时拒绝不安全回退、身份组可选、无服务器时拒绝角色限制、设置保存顺序和错误提示。
- `bun check -b`：通过；对本次修改的 TS/TSX 文件执行 `oxlint`：无错误。
- `bun run build` 和 `go build -o .git/new-api.exe .`：通过。
- `git diff --check`：通过。

本次还修复了上游测试辅助代码在 Windows 下未关闭临时 SQLite 连接的问题；这只影响自动化测试的资源清理，不修改运行中数据库或用户数据。

项目原有的全量前端 lint 和版权头检查存在本次修改之外的问题，未借本次功能开发批量改写无关文件。新增前端文件保留项目版权头，原有项目名称、作者署名和许可证未移除。

这些自动化测试不能代替上线前的真实多账号授权联调；本轮上传审查未执行 Docker 镜像构建、生产部署或全站安全合规认证。用户此前的单账号本机验收不替代服务器黑名单、角色组合、邀请码满额和注册最后一位的正式部署验收。
