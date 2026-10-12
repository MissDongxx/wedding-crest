# 轻量设计修改助手第一版

实现描述→视觉计划/澄清→确认→现有参考图编辑。修改单不消耗生图次数；确认后走原生图额度。旧版批次不再隐藏，用户可采用新版本或回退旧版。

证据：artifacts/design-assistant/verification.md；类型检查exit0、6项计划校验通过、真实Next组件的模拟API浏览器流程通过。接口无访问身份返回401。

边界：当前缺OpenRouter密钥，真实视觉模型/编辑结果质量未联调，未部署。其他非中英文语言的助手文案暂用英文。此前付款分析由用户澄清：LaLune为测试用户，除其外只有1位真实用户点击支付但未付；不能用测试订单估算真实支付成功率。

下一步：配置助手运行时密钥→用测试身份评估明确请求/模糊请求/文字保持/失败恢复→检查模型成本与上线限流，再考虑部署。应用预览、免注册支付不在此次改动内。

## 当前修订：edits优先、Runware Gemini
用户明确选择Runware而非OpenRouter。助手已移到Quick edits/Edit details下方，默认折叠，只作为现有编辑选项不足时的补充。复用后台runware_api_key，新增可选runware_assistant_model，默认google:gemini@3.1-flash-lite；原图像模型配置不变。
真实公开样例视觉规划HTTP200并通过修改单schema校验。最初json_object参数被Runware拒绝，移除后成功。当前已不再缺OpenRouter密钥。详见artifacts/design-assistant-runware/verification.md。仍未部署或对真实用户图生成修改。

## 真实页面错误修复
原localhost:3000接口返回HTML500，错误页显示Turbopack runtime丢失；此前并行Next进程共享.next是支持的冲突机制。保留旧缓存并重启原开发服务器，页面刷新后翻译恢复。新增NEXT_DIST_DIR用于隔离后续并行验证。
进一步真实项目复测发现正式API仍带json_object参数（先前只修正了独立测试脚本），导致Runware400；本轮正式移除。加入通用JSON响应解析，HTML错误以HTTP状态提示。原项目“移除border线条”已真实返回200并显示修改单，未确认生图。证据artifacts/design-assistant-error-fix/verification.md。

## 生成完成提示和定位
生成或修改完成后弹本地化成功提示、自动回到页面顶部并展示最新图片；已完成项目再次打开不弹提示。用displayedGeneration防止重复轮询把刚展示的新图切回旧选择。独立缓存验证浏览器结果scrollY=0、主图URL为最新fixture、toast=true，未消耗真实额度。证据artifacts/generation-complete/verification.md。
