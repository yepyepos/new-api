# Discord 社区限定 New API 中转站：可行性调查

> 本文是开发前的历史调研记录。当前二次开发版本的功能、配置步骤和限制，请参阅 [Discord 社区登录版使用说明](discord-community-setup.md)。

调查日期：2026-10-30。范围：Discord 官方 OAuth2、成员接口、Gateway 事件，以及本机源码的只读检查。尚未部署、未使用真实凭据、未进行 Discord 实机联调。

## 结论

技术上可行：让用户用 Discord 登录，确认其属于指定服务器，并可额外要求持有指定身份组，然后再允许使用 New API。基础版本不需要 Discord 机器人，用户授权本身即可查询自己在指定服务器里的成员资料。[1][2]

这里的“服务器”是 Discord 社区，而不是运行 New API 的云服务器。“身份组/角色”（Role）是社区内的成员标签；它与政府身份证实名核验完全不同。站主说的“身份证验证”是否其实指“身份组验证”，必须向站主或用户核实，不能直接断言。[3]

Discord 的 `identify` 只支持读取 Discord 用户身份资料，不等于验证法定姓名、政府身份证或真实自然人身份；本调查涉及的成员接口同样不提供政府身份证核验能力。[1][2] 如果确实需要政府证件实名，应另行评估目的、适用法律、敏感信息收集、保留与删除责任；不建议在需求未明确前自行收集证件照片。

## 官方接口证据

### 无机器人方案

采用 OAuth2 授权码流程（用户在 Discord 同意授权，网站后端用返回的临时授权码换取访问凭据）：[1]

1. 请求 `identify`，调用 `GET /users/@me`，拿到用户的 Discord ID，绑定 New API 账户。
2. 同时请求 `guilds.members.read`，调用 `GET /users/@me/guilds/{guild.id}/member`，查询这个用户在目标服务器的成员信息。[2]
3. 返回对象的 `roles` 是身份组 ID 列表，可用来验证指定角色；应使用角色 ID，不按可改名、可重复的角色名称判断。[3]
4. 返回对象的可选字段 `pending` 表示尚未通过服务器的 Membership Screening（入群规则确认/成员筛选），它不是政府身份证实名。若运营规则要求完成入群筛选，应拒绝 `pending=true` 的成员。[3]

该当前用户接口要求的是用户 OAuth2 授权范围，没有机器人安装要求。因此只核验本人在一个已知服务器的身份，不需要先把机器人加入服务器。[1][2]

最小授权范围为 `identify guilds.members.read`；本需求不需要获取邮箱的 `email`、枚举所有服务器的 `guilds`、自动拉人进群的 `guilds.join`，也不需要 `bot` 范围。[1] 如果现有登录还使用其他范围，应结合原功能决定保留哪些，而不是机械删除。

必须验证 OAuth2 的 `state`（把这次回调与发起登录的浏览器请求配对，防止被冒用）；客户端密钥、访问凭据和刷新凭据不能发给网页或写入日志。官方授权码流程返回访问凭据和刷新凭据，支持刷新过期访问凭据。[1]

### 持续退群/撤角色控制

仅在注册或登录时检查，不能保证退出服务器后，已经签发的 New API 密钥也停止使用；这是应用侧的授权设计问题，而不是 Discord 登录自动解决的问题。

可选设计：

- 无机器人：后端安全保存用户的刷新凭据，定期或在资格缓存过期时重新调用成员接口；用户撤销授权或刷新失效时要求重新授权。轮询不是实时事件，退群和停止使用之间存在缓存窗口。[1][2]
- 有机器人：把机器人加入目标服务器，接收 `GUILD_MEMBER_REMOVE`（离开、被踢、被封禁）和 `GUILD_MEMBER_UPDATE`（包括角色列表变更），更新本地资格缓存。[4][5]
- 机器人事件方案需启用并在连接时声明 `GUILD_MEMBERS` 特权意图（允许接收成员变更事件的数据开关），根据应用规模及 Discord 开发者后台规则可能还需审核；不是授予机器人服务器“管理员”的意思。[4]
- 只读验证不需要 `Administrator`、`Manage Roles`、读取消息内容或成员在线状态。不要为了图方便授予管理员，也不要为本需求申请 `MESSAGE_CONTENT`、`GUILD_PRESENCES`。[3][4][5]
- 机器人可用 `GET /guilds/{guild.id}/members/{user.id}` 查询特定已知用户。官方把 `GUILD_MEMBERS` 强制要求明确写在相邻的 `List Guild Members` 全员列表接口上，不能把两个接口混为一谈；事件监听本身仍需上述成员意图。[3][4]

建议先实现无机器人基础版；若明确要求退群/撤角色后很快停用，再增加机器人事件和定期补查。事件不能替代断线恢复与补查：需要考虑机器人离线时漏掉的变化。

资格必须在 New API 的实际 API 请求入口生效，而不只是前端隐藏页面或禁止新登录。建议单独记录“社区资格”，不要把系统封禁、欠费和退群永久混为同一个账户状态；退群后的余额、历史记录不应自动删除。

Discord 接口超时、限流、令牌失效与“确认不是成员”不是一回事。上线前必须选择失败时临时拦截还是短期使用已有资格缓存；不能把一次网络异常当作永久退群或清空余额。不要每个模型请求都实时访问 Discord，应有资格缓存、并发控制、限流退避和过期策略。

## 本机 New API 的适配基础

当前工作目录 `D:\codex\newapi` 在调查开始时为空；实际只读检查对象是相邻目录 `D:\codex\new-api`。仅在当前工作目录创建本调查笔记，未更改实际项目源码或配置。

- `D:\codex\new-api\oauth\discord.go:113` 已调用 Discord `GET /api/v10/users/@me`，可复用现有登录和账户绑定流程；目前没有在该提供方中做服务器/角色成员校验。
- `D:\codex\new-api\setting\system_setting\discord.go:5` 的 Discord 设置当前只有 `Enabled`、`ClientId`、`ClientSecret`，尚需目标服务器、角色与校验策略配置。
- `D:\codex\new-api\model\user.go:89` 已有 `DiscordId`，不必另造一套 Discord 身份关联。
- `D:\codex\new-api\middleware\auth.go:352` 的 `TokenAuth` 是 API 密钥认证入口；其中 `:451` 检查用户启用状态，但该路径未见独立的 Discord 社区资格判断。持续控制需接入实际请求授权链路。

以上说明存在可复用的基础，但并不代表目前开箱即有“指定服务器/角色准入”。未对整套项目进行安全审计，亦未验证其他登录路径、管理员账户或旧密钥的最终绕过情况。

## 开始开发前应确认

1. 所说的“身份证”究竟是 Discord 身份组，还是政府身份证实名？最好提供站主原话或截图。
2. 目标服务器是否由用户管理，是否能创建 Discord 开发者应用、配置 HTTPS 回调；若用机器人，是否能安装到目标服务器？不要在聊天中发送任何密钥。
3. 只要求在群内，还是必须有一个或多个角色？多个角色之间是满足任一个还是全部满足？
4. 只限制注册，还是登录与实际 API 使用都限制？退出/撤角色后允许多长延迟，如何恢复资格？
5. 现有本地账户、管理员、余额、旧 API 密钥如何兼容，是否需要豁免？
6. 上游 API 的来源及转售许可、服务区域、支付退款、费用与滥用控制是否明确？这些不由 Discord 登录验证解决，本次未调查其合规结论。

## 引用来源

[1] Discord OAuth2：授权范围、授权码、刷新凭据、state 安全说明。
https://docs.discord.com/developers/topics/oauth2

[2] Discord User Resource，Get Current User / Get Current User Guild Member：指定服务器的当前用户成员查询及 `guilds.members.read` 要求。
https://docs.discord.com/developers/resources/user#get-current-user-guild-member

[3] Discord Guild Resource，Guild Member Object / Get Guild Member / List Guild Members：`roles`、`pending`、单用户查询及全员查询区别。
https://docs.discord.com/developers/resources/guild#guild-member-object
https://docs.discord.com/developers/resources/guild#get-guild-member
https://docs.discord.com/developers/resources/guild#list-guild-members

[4] Discord Gateway，List of Intents / Privileged Intents：成员事件的 `GUILD_MEMBERS` 开关与审核。
https://docs.discord.com/developers/events/gateway#list-of-intents
https://docs.discord.com/developers/events/gateway#privileged-intents

[5] Discord Gateway Events，Guild Member Remove / Guild Member Update：退群事件与包含角色列表的成员更新事件。
https://docs.discord.com/developers/events/gateway-events#guild-member-remove
https://docs.discord.com/developers/events/gateway-events#guild-member-update

核验方法：本次直接获取上述 Discord 官方文档的 `.md` 版本并阅读相应章节；文档可能更新，尤其特权意图的审核门槛应以上线时的开发者后台与最新文档为准。
