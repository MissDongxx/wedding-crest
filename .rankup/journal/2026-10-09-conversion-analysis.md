# 试用→付费诊断（2026-10-09）

## 范围与限制
只读检查当前代码、线上首页/登录弹窗/创建页，以及 .env.local 所指 PostgreSQL wedding-crest schema 的匿名聚合。尚未核实该数据库是否与生产 binding 完全一致；未排除内部测试账号。未发起生成、订单或付款，未改应用代码。旧 baseline 的线上域名未知记录已过时：本轮实际访问 https://weddingcrestdesign.com/ 。

## 用户后续校正（本轮实施前已确认）
LaLune为测试用户；排除后仅1位真实用户点击支付，未付款。下列聚合包含测试记录，不应作为真实用户转化率或渠道失败率。

## 聚合事实
- 项目126：complete90、failed21、generating7、draft8。user_id非空12、空114；complete中已登录6、游客84。项目数不是独立访客或注册人数，归属状态不是历史登录转化率。
- 生成记录complete102（90个项目）、generating13（7个项目）。failed项目不能据此直接计算当前生成失败率。
- 订单13：paid1、created9、completed3。全部PayPal；覆盖2个不同user_id，仅1个非空project_id。重复/测试订单可能影响统计。
- 已付款记录日期2026-08-25，amount1900美分，paid_at 07:22:27 UTC（15:22:27 Asia/Shanghai）；是否测试单待核实。
- 9月20日3单completed均无checkout_url。代码在createPayment抛异常时设置completed；该状态在本接口代表创建结账失败，不是付款成功。
- 10月截至观察时32个complete项目、1个created订单（990美分）、无paid订单。日期分组输出按数据库会话时区，不用于小时级归因。
- 默认支付渠道paypal；paypal_enabled和waffo_enabled为true。结果页未传payment_provider，沿用默认；启用第二渠道不等于该入口向用户提供渠道选择。

## 线上和代码证据
- 首页Unlock My Crest按钮实际弹Sign In（Email/密码、Sign Up入口），未进入付款；该次浏览器控制台未捕获error/warn。创建页正常显示7步表单；未验证完整生成/结账/下载流程。
- wedding-result.tsx：游客付费点击跳sign-in，callbackUrl为design/id?paid=1；本组件未发现据paid参数自动恢复checkout的逻辑。登录后实际行为尚待完整验证。
- wedding-result.tsx AiCrestImage使用sourceImageUrl；未付费仅增加HTML水印覆盖层。ZIP接口有付费校验，但预览原图曝光令付费交付边界薄弱。没有证据证明用户实际利用这一点。
- 当前$9.9交付PNG/JPEG/WebP原图、更多生成和指南，不保证矢量、透明底、固定像素/DPI。首页有婚礼请柬/标牌承诺，交付适用性仍需实测；“Real Fonts”与AI统一生成文字之间的预期管理值得核对。
- 相关核心页面未发现专用试用→解锁→登录→结账漏斗事件；第三方自动采集能力未核实。

## 判断与下一步
最强信号是成功项目以游客为主、订单集中极少账号，而非单纯价格过高。优先核对数据库环境及剔除测试样本，验证游客登录后项目认领/恢复购买、排查PayPal结账创建失败及渠道可达性；其次将免费预览改为独立带水印低分辨率文件，原文件通过付费授权交付；展示真实交付示例/透明底及打印规格（只承诺实测能力）。补齐漏斗后按来源/设备拆分，才能判断流量意图、结果质量或价格是否主因。现阶段不建议仅因零付款就降价或增加试用次数。
