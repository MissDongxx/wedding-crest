type Diagnostic = {
  source: string;
  stage: string;
  reason?: string | null;
  createdAt: Date | string;
  httpStatus?: number | null;
  latencyMs?: number | null;
  details?: string | null;
};

const zhLabels: Record<string, string> = {
  clicked: '点击购买',
  request_failed: '结账请求失败',
  session_created: '浏览器收到收银台链接',
  redirect_started: '开始跳转收银台',
  redirect_left: '观察到原页面离开',
  redirect_not_left: '跳转后原页面仍可见（弱信号）',
  returned: '浏览器返回本站',
  access_unconfirmed: '返回后暂未确认购买权益',
  checkout_received: '服务端收到结账请求',
  checkout_created: '平台收银台创建成功',
  checkout_reused: '复用有效收银台',
  checkout_expired: '拦截过期收银台',
  checkout_rejected: '结账校验未通过',
  checkout_create_failed: '创建收银台失败',
  callback_received: '收到付款返回请求',
  callback_status: '付款返回状态',
  callback_failed: '付款返回处理异常',
  cancel_received: '收到取消请求',
  cancel_status: '取消处理结果',
  cancel_failed: '取消处理异常',
  webhook_received: '收到支付平台通知',
  webhook_status: '平台通知处理结果',
  webhook_failed: '平台通知处理异常',
  payment_query_failed: '支付平台状态查询异常',
  insufficient_funds: '余额不足',
  expired_card: '银行卡已过期',
  incorrect_cvc: '安全码错误',
  incorrect_card_number: '卡号错误',
  authentication_required: '需要或未完成银行卡验证',
  card_declined: '支付平台报告银行卡被拒',
  do_not_honor: '银行拒绝交易',
  risk_rejected: '平台风控拒绝',
  payment_method_unsupported: '支付方式不支持',
  provider_rejected: '平台拒绝（未归类原因）',
  network_error: '网络错误',
  http_error: '结账请求返回 HTTP 错误',
  request_validation_failed: '结账参数校验失败',
  identity_required: '缺少结账身份',
  project_not_found: '找不到项目或没有访问权限',
  invalid_origin: '结账来源校验失败',
  internal_error: '服务端异常',
  provider_http_error: '支付平台 HTTP 错误',
  redirect_error: '浏览器跳转异常',
  returned_failed: '返回页显示付款失败',
  timeout: '请求超时',
  provider_timeout: '平台查询超时',
  invalid_response: '响应格式异常',
  invalid_checkout_url: '收银台链接无效',
  redirect_timeout: '未观察到离站（弱信号）',
  checkout_ended: '原收银台已结束',
  no_payment_record: '支付平台暂无付款记录',
  provider_query_error: '平台查询异常（不是付款失败）',
  payment_processing: '平台处理中',
  payment_succeeded: '平台已确认收款',
  provider_payment_failed: '平台报告付款失败',
  provider_payment_canceled: '平台报告取消付款',
  admin_platform_checked: '管理员查询支付平台',
  platform_read_not_supported: '此渠道暂未接入只读状态查询',
};

export const paymentDiagnosticLabel = (value: string, locale: string) =>
  locale === 'zh' ? zhLabels[value] || value : value;

/** Only safe, server-filtered event fields are rendered; never provider payloads. */
export function PaymentDiagnostics({
  events,
  locale,
}: {
  events: Diagnostic[];
  locale: string;
}) {
  const zh = locale === 'zh';
  const label = (value: string) => paymentDiagnosticLabel(value, locale);
  if (!events.length) {
    return (
      <span className="text-muted-foreground text-xs">
        {zh ? '暂无埋点记录（含上线前订单）' : 'No recorded diagnostics (including older orders)'}
      </span>
    );
  }
  const latest = events[events.length - 1];
  return (
    <details className="min-w-56 max-w-md text-xs">
      <summary className="cursor-pointer leading-5">
        {label(latest.reason || latest.stage)} · {events.length}
      </summary>
      <p className="text-muted-foreground my-2 max-w-sm">
        {zh
          ? '浏览器跳转或未返回只是观测信号，不代表银行拒付。平台报告与服务端事件单独标明。时间为 UTC。'
          : 'Browser navigation or no return is not proof of a bank decline. Provider/server events are identified separately. Times are UTC.'}
      </p>
      <ol className="max-h-80 space-y-2 overflow-y-auto border-l pl-3">
        {events.map((event, index) => {
          const date = new Date(event.createdAt);
          const timestamp = Number.isNaN(date.getTime()) ? '-' : date.toISOString();
          return (
            <li key={index} className="break-words leading-5">
              <time className="text-muted-foreground block" dateTime={timestamp}>
                {timestamp}
              </time>
              <span className="font-medium">[{event.source}] {label(event.stage)}</span>
              {event.reason && <span className="block">{label(event.reason)}</span>}
              {event.httpStatus && <span className="mr-2">HTTP {event.httpStatus}</span>}
              {event.latencyMs != null && <span>{event.latencyMs} ms</span>}
              {event.details && <code className="text-muted-foreground block text-[11px]">{event.details}</code>}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
