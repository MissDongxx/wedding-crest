import {
  classifyProviderPaymentReason,
  safePaymentCode,
} from './payment-diagnostics-contract';

export const interactionLabels = {
  regenerate_clicked: '点击重新生成',
  download_clicked: '点击下载',
  feedback_liked: '反馈：喜欢',
  feedback_adjust: '反馈：想调整',
  feedback_unsatisfied: '反馈：不满意',
} as const;

export function summarizeFunnelInteractions(
  events: { eventName: string; anonymousId: string; isTest: boolean }[]
) {
  const testBrowsers = new Set(
    events.filter((event) => event.isTest).map((event) => event.anonymousId)
  );
  return Object.entries(interactionLabels).map(([eventName, label]) => {
    const matching = events.filter(
      (event) =>
        event.eventName === eventName && !testBrowsers.has(event.anonymousId)
    );
    return {
      label,
      events: matching.length,
      browsers: new Set(matching.map((event) => event.anonymousId)).size,
    };
  });
}

export const paymentSignalLabels = {
  started: '发起结账',
  ready: '获得结账链接',
  redirect_started: '发起跳转',
  redirect_left: '观察到原页面离开',
  redirect_not_left: '跳转超时，未观察到离开',
  returned: '记录到浏览器返回',
  access_unconfirmed: '返回后权益尚未确认',
} as const;

export const orderResultLabels = {
  paid: '已付款',
  failed: '付款失败',
  canceled: '已取消',
  completed: '创建 checkout 失败',
  created: '待付款',
  pending: '准备 checkout 中',
} as const;

type Order = { orderNo: string; status: string };
type Diagnostic = {
  id: string;
  source: string;
  stage: string;
  reason: string | null;
  details: string | null;
  attemptId: string | null;
  requestId: string | null;
  ownerId: string | null;
  orderNo: string | null;
  orderStatus: string | null;
};

const failureStages = new Set([
  'request_failed',
  'checkout_rejected',
  'checkout_failed',
  'checkout_expired',
  'provider_create_failed',
  'provider_checkout_failed',
  'provider_payment_lookup_failed',
  'callback_failed',
  'webhook_failed',
  'cancel_failed',
  'redirect_not_left',
  'access_unconfirmed',
]);
const paymentFailureReasons = new Set([
  'provider_payment_failed',
  'provider_query_error',
  'returned_failed',
]);
const returnLabels: Record<string, string> = {
  returned_paid: '返回页显示已付款',
  returned_prepaid: '返回页显示已激活',
  returned_pending: '返回页显示处理中',
  returned_failed: '返回页显示付款失败',
  returned_canceled: '返回页显示取消',
  returned_access_required: '返回页要求恢复访问',
  returned_unknown: '返回状态未知',
};

function diagnosticReason(event: Diagnostic) {
  if (
    event.source === 'provider' &&
    event.stage === 'provider_payment_lookup'
  ) {
    try {
      const raw = JSON.parse(event.details ?? '{}');
      const providerReason = classifyProviderPaymentReason(raw?.providerReason);
      if (providerReason && event.reason === 'provider_payment_failed')
        return providerReason;
    } catch {}
  }
  return safePaymentCode(event.reason) ?? 'unspecified';
}

export function summarizeFunnelPayments(
  diagnostics: Diagnostic[],
  recentOrders: Order[]
) {
  const signalKeys = Object.keys(paymentSignalLabels) as Array<
    keyof typeof paymentSignalLabels
  >;
  const signals = Object.fromEntries(
    signalKeys.map((key) => [key, 0])
  ) as Record<keyof typeof paymentSignalLabels, number>;
  const results = Object.fromEntries(
    Object.keys(orderResultLabels).map((key) => [key, 0])
  ) as Record<keyof typeof orderResultLabels, number>;
  const orders = new Map(
    recentOrders.map((order) => [order.orderNo, order.status])
  );
  const attemptKey = (event: Diagnostic) =>
    event.attemptId && event.ownerId
      ? `attempt:${event.ownerId}:${event.attemptId}`
      : undefined;
  const requestKey = (event: Diagnostic) =>
    event.requestId && event.attemptId
      ? `${event.requestId}:${event.attemptId}`
      : undefined;
  // Initial server rows may lack an owner; join by the server request ID only
  // when it identifies one owner/attempt. Do not merge unrelated owners.
  const requestAttempts = new Map<string, Set<string>>();
  for (const event of diagnostics) {
    if (event.orderNo && event.orderStatus)
      orders.set(event.orderNo, event.orderStatus);
    const key = attemptKey(event);
    const request = requestKey(event);
    if (key && request) {
      const keys = requestAttempts.get(request) ?? new Set<string>();
      keys.add(key);
      requestAttempts.set(request, keys);
    }
  }
  const attempts = new Map<string, Diagnostic[]>();
  const orderDiagnostics = new Map<string, Diagnostic[]>();
  for (const event of diagnostics) {
    if (event.orderNo && orders.has(event.orderNo)) {
      const records = orderDiagnostics.get(event.orderNo) ?? [];
      records.push(event);
      orderDiagnostics.set(event.orderNo, records);
    }
    if (!event.attemptId) continue;
    const request = requestKey(event);
    const byRequest = request ? requestAttempts.get(request) : undefined;
    const key =
      attemptKey(event) ??
      (byRequest?.size === 1 ? [...byRequest][0] : undefined) ??
      (request ? `request:${request}` : `event:${event.id}`);
    const records = attempts.get(key) ?? [];
    records.push(event);
    attempts.set(key, records);
  }

  const reasons = new Map<
    string,
    { withOrder: Set<string>; withoutOrder: Set<string> }
  >();
  const addReason = (
    reason: string,
    orderNo: string | undefined,
    attempt: string
  ) => {
    const row = reasons.get(reason) ?? {
      withOrder: new Set<string>(),
      withoutOrder: new Set<string>(),
    };
    if (orderNo) row.withOrder.add(orderNo);
    else row.withoutOrder.add(attempt);
    reasons.set(reason, row);
  };
  const isFailure = (event: Diagnostic) =>
    failureStages.has(event.stage) ||
    ([
      'returned',
      'callback_payment_lookup',
      'provider_payment_lookup',
    ].includes(event.stage) &&
      paymentFailureReasons.has(event.reason ?? ''));
  const returns = new Map<string, number>();
  let failuresWithoutOrder = 0;
  for (const [key, events] of attempts) {
    const orderNo =
      events.find((event) => event.orderNo && orders.has(event.orderNo))
        ?.orderNo ?? undefined;
    const stages = new Set(events.map((event) => event.stage));
    if (stages.has('clicked') || stages.has('checkout_received'))
      signals.started++;
    if (stages.has('session_created') || stages.has('checkout_response'))
      signals.ready++;
    for (const signal of signalKeys) {
      if (signal !== 'started' && signal !== 'ready' && stages.has(signal))
        signals[signal]++;
    }
    for (const state of new Set(
      events
        .filter((event) => event.stage === 'returned')
        .map((event) => event.reason)
    )) {
      const label = (state && returnLabels[state]) || '返回状态未知';
      returns.set(label, (returns.get(label) ?? 0) + 1);
    }
    const failures = events.filter(isFailure);
    if (!orderNo && failures.length) failuresWithoutOrder++;
    for (const failure of failures) {
      // Explicit order references win if one browser attempt reused checkout.
      const explicit =
        failure.orderNo && orders.has(failure.orderNo)
          ? failure.orderNo
          : orderNo;
      if (!explicit) addReason(diagnosticReason(failure), undefined, key);
      // Order-linked diagnostics are counted in the per-order pass below.
      else if (!failure.orderNo || !orders.has(failure.orderNo))
        addReason(diagnosticReason(failure), explicit, key);
    }
  }
  for (const [orderNo, status] of orders) {
    if (Object.hasOwn(orderResultLabels, status))
      results[status as keyof typeof orderResultLabels]++;
    const failures = (orderDiagnostics.get(orderNo) ?? []).filter(isFailure);
    for (const failure of failures)
      addReason(diagnosticReason(failure), orderNo, '');
    if (['failed', 'completed'].includes(status) && !failures.length)
      addReason('unspecified', orderNo, '');
  }

  return {
    signals,
    results,
    failuresWithoutOrder,
    returns: [...returns].map(([label, count]) => ({ label, count })),
    reasons: [...reasons]
      .map(([reason, count]) => ({
        reason,
        withOrder: count.withOrder.size,
        withoutOrder: count.withoutOrder.size,
      }))
      .sort(
        (a, b) =>
          b.withOrder + b.withoutOrder - a.withOrder - a.withoutOrder ||
          a.reason.localeCompare(b.reason)
      ),
  };
}
