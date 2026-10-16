import { z } from 'zod';

export const funnelInput = z
  .object({
    id: z.string().uuid(),
    anonymousId: z.string().uuid(),
    eventName: z.enum([
      'create_clicked',
      'project_created',
      'result_viewed',
      'unlock_viewed',
      'unlock_clicked',
      'checkout_failed',
      'regenerate_clicked',
      'download_clicked',
      'feedback_liked',
      'feedback_adjust',
      'feedback_unsatisfied',
    ]),
    projectId: z.string().min(1).max(100).optional(),
    generationId: z.string().min(1).max(100).optional(),
    flowId: z.string().min(1).max(100),
    entryPosition: z.enum(['wizard', 'result']),
  })
  .strict();

export type FunnelRow = {
  anonymousId: string;
  userId?: string | null;
  flowId: string;
  projectId?: string | null;
  eventName: string;
  createdAt: Date;
  isTest: boolean;
};
export const stages = [
  '未成功生成',
  '生成完成，未看到结果',
  '看到结果，未看到购买模块',
  '看到购买模块，未点击',
  '点击购买，没有 checkout',
  '已有 checkout',
] as const;
export function classifyFunnel(
  events: FunnelRow[],
  generations: {
    projectId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }[],
  orders: {
    projectId: string | null;
    createdAt: Date;
    productId: string | null;
    checkoutUrl?: string | null;
    paymentSessionId?: string | null;
  }[],
  now = new Date()
) {
  const excluded = new Set(
    events.filter((e) => e.isTest).map((e) => e.anonymousId)
  );
  const cohorts = new Map<string, { start: Date; events: FunnelRow[] }>();
  for (const e of events
    .filter((e) => !excluded.has(e.anonymousId))
    .sort((a, b) => +a.createdAt - +b.createdAt)) {
    if (e.eventName !== 'create_clicked') continue;
    // Unique browsers are stable across login; cross-device identity is not inferred.
    if (!cohorts.has(e.anonymousId))
      cohorts.set(e.anonymousId, { start: e.createdAt, events: [] });
  }
  return [...cohorts.entries()].map(([anonymousId, c]) => {
    const end = +c.start + 86400000;
    const own = events.filter(
      (e) =>
        !e.isTest &&
        e.anonymousId === anonymousId &&
        +e.createdAt >= +c.start &&
        +e.createdAt <= end
    );
    const flows = new Set(
      own.filter((e) => e.eventName === 'create_clicked').map((e) => e.flowId)
    );
    const projects = new Set(
      own
        .filter((e) => e.eventName === 'project_created' && flows.has(e.flowId))
        .map((e) => e.projectId)
        .filter(Boolean)
    );
    const tracked = own.filter(
      (e) =>
        e.eventName === 'create_clicked' ||
        (e.projectId && projects.has(e.projectId))
    );
    let stage = 0;
    if (
      generations.some(
        (g) =>
          projects.has(g.projectId) &&
          +g.createdAt >= +c.start &&
          +g.updatedAt <= end &&
          ['complete', 'completed', 'selected'].includes(g.status)
      )
    )
      stage = 1;
    if (tracked.some((e) => e.eventName === 'result_viewed')) stage = 2;
    if (tracked.some((e) => e.eventName === 'unlock_viewed')) stage = 3;
    if (tracked.some((e) => e.eventName === 'unlock_clicked')) stage = 4;
    if (
      orders.some(
        (o) =>
          o.productId === 'wedding_identity_pack' &&
          !!(o.checkoutUrl || o.paymentSessionId) &&
          projects.has(o.projectId) &&
          +o.createdAt >= +c.start &&
          +o.createdAt <= end
      )
    )
      stage = 5;
    return {
      anonymousId,
      stage,
      observing: +now < end,
      projects: projects.size,
      checkoutFailed: tracked.some((e) => e.eventName === 'checkout_failed'),
    };
  });
}
