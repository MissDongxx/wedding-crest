import { and, desc, eq, gte, isNotNull, ne, or } from 'drizzle-orm';
import { setRequestLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { PERMISSIONS, requirePermission } from '@/core/rbac';
import {
  order,
  paymentDiagnosticEvent,
  weddingFunnelEvent,
  weddingGeneration,
} from '@/config/db/schema';
import { Header, Main } from '@/shared/blocks/dashboard';
import { paymentDiagnosticLabel } from '@/shared/components/wedding/payment-diagnostics';
import { classifyFunnel, stages } from '@/shared/wedding/funnel';
import {
  orderResultLabels,
  paymentSignalLabels,
  summarizeFunnelInteractions,
  summarizeFunnelPayments,
} from '@/shared/wedding/funnel-report';

const MAX_DIAGNOSTICS = 5000;

type ReportOrder = Pick<
  typeof order.$inferSelect,
  | 'orderNo'
  | 'userId'
  | 'status'
  | 'projectId'
  | 'productId'
  | 'createdAt'
  | 'checkoutUrl'
  | 'paymentSessionId'
>;
type ReportDiagnostic = Parameters<
  typeof summarizeFunnelPayments
>[0][number] & {
  projectId: string | null;
  orderOwner: string | null;
  orderProject: string | null;
};

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission({
    code: PERMISSIONS.PAYMENTS_READ,
    redirectUrl: '/no-permission',
    locale,
  });
  const days = (await searchParams).days === '30' ? 30 : 7;
  const now = new Date();
  const start = new Date(+now - days * 86400000);
  let report: ReturnType<typeof classifyFunnel> = [];
  let interactions: ReturnType<typeof summarizeFunnelInteractions> = [];
  let payments: ReturnType<typeof summarizeFunnelPayments> | undefined;
  let truncated = false;
  let unavailable = false;
  const testOwners = new Set(
    (process.env.WEDDING_FUNNEL_TEST_USER_IDS || '').split(',').filter(Boolean)
  );
  const testProjects = new Set<string>();
  let events: (typeof weddingFunnelEvent.$inferSelect)[] = [];
  try {
    events = await db()
      .select()
      .from(weddingFunnelEvent)
      .where(gte(weddingFunnelEvent.createdAt, start));
    const testBrowsers = new Set(
      events.filter((event) => event.isTest).map((event) => event.anonymousId)
    );
    for (const event of events) {
      if (!testBrowsers.has(event.anonymousId)) continue;
      if (event.userId) testOwners.add(event.userId);
      if (event.projectId) testProjects.add(event.projectId);
    }
    interactions = summarizeFunnelInteractions(events);
  } catch {
    unavailable = true;
  }
  try {
    const orders: ReportOrder[] = await db()
      .select({
        orderNo: order.orderNo,
        userId: order.userId,
        status: order.status,
        projectId: order.projectId,
        productId: order.productId,
        createdAt: order.createdAt,
        checkoutUrl: order.checkoutUrl,
        paymentSessionId: order.paymentSessionId,
      })
      .from(order)
      .where(gte(order.createdAt, start));
    try {
      const diagnosticRows: ReportDiagnostic[] = await db()
        .select({
          id: paymentDiagnosticEvent.id,
          source: paymentDiagnosticEvent.source,
          stage: paymentDiagnosticEvent.stage,
          reason: paymentDiagnosticEvent.reason,
          details: paymentDiagnosticEvent.details,
          attemptId: paymentDiagnosticEvent.attemptId,
          requestId: paymentDiagnosticEvent.requestId,
          ownerId: paymentDiagnosticEvent.ownerId,
          projectId: paymentDiagnosticEvent.projectId,
          orderNo: paymentDiagnosticEvent.orderNo,
          orderStatus: order.status,
          orderOwner: order.userId,
          orderProject: order.projectId,
        })
        .from(paymentDiagnosticEvent)
        .leftJoin(order, eq(paymentDiagnosticEvent.orderNo, order.orderNo))
        .where(
          and(
            gte(paymentDiagnosticEvent.createdAt, start),
            ne(paymentDiagnosticEvent.stage, 'admin_platform_checked'),
            or(
              isNotNull(paymentDiagnosticEvent.attemptId),
              isNotNull(order.orderNo)
            )
          )
        )
        .orderBy(
          desc(paymentDiagnosticEvent.createdAt),
          desc(paymentDiagnosticEvent.id)
        )
        .limit(MAX_DIAGNOSTICS + 1);
      truncated = diagnosticRows.length > MAX_DIAGNOSTICS;
      const excluded = (ownerId: string | null, projectId: string | null) =>
        (!!ownerId && testOwners.has(ownerId)) ||
        (!!projectId && testProjects.has(projectId));
      const excludedRequests = new Set(
        diagnosticRows
          .filter(
            (row) =>
              excluded(row.ownerId, row.projectId) ||
              excluded(row.orderOwner, row.orderProject)
          )
          .map((row) => row.requestId)
          .filter(Boolean)
      );
      payments = summarizeFunnelPayments(
        diagnosticRows
          .slice(0, MAX_DIAGNOSTICS)
          .filter(
            (row) =>
              !excluded(row.ownerId, row.projectId) &&
              !excluded(row.orderOwner, row.orderProject) &&
              !excludedRequests.has(row.requestId)
          ),
        orders.filter((row) => !excluded(row.userId, row.projectId))
      );
    } catch {
      // A missing diagnostics table must not hide the existing Create funnel.
    }
    if (!unavailable) {
      const generations = await db()
        .select({
          projectId: weddingGeneration.projectId,
          status: weddingGeneration.status,
          createdAt: weddingGeneration.createdAt,
          updatedAt: weddingGeneration.updatedAt,
        })
        .from(weddingGeneration)
        .where(gte(weddingGeneration.createdAt, start));
      report = classifyFunnel(events, generations, orders, now);
    }
  } catch {
    unavailable = true;
  }
  const mature = report.filter((r) => !r.observing);
  const observing = report.length - mature.length;
  return (
    <>
      <Header
        crumbs={[
          { title: 'Admin', url: '/admin' },
          { title: 'Create funnel', is_active: true },
        ]}
      />
      <Main>
        <h1 className="text-2xl font-semibold">Create 后行为漏斗</h1>
        <nav className="my-4 flex gap-4">
          <a href="?days=7" className={days === 7 ? 'font-bold underline' : ''}>
            最近 7 天
          </a>
          <a
            href="?days=30"
            className={days === 30 ? 'font-bold underline' : ''}
          >
            最近 30 天
          </a>
        </nav>
        {unavailable ? (
          <p role="alert">
            漏斗数据暂不可用。请检查数据库连接及 wedding_funnel_event
            迁移；不是零用户。
          </p>
        ) : (
          <>
            <p>
              已跟踪 Create 去重浏览器用户：{report.length} · 完成 24 小时观察：
              {mature.length} · 观察中：{observing}
            </p>
            <p className="text-muted-foreground my-3 text-sm">
              仅包含埋点上线后的 Create；没有历史行为回填。按首次 Create 后 24
              小时内最深步骤互斥分类。匿名 ID 跨登录保持，跨设备不合并；checkout
              复用后台订单，按同项目及时间窗口关联。事件漏报可能造成低估，流失位置不是心理原因。生成完成依据现有状态及更新时间；选择图片等后续更新可能导致完成时间归属不精确。
            </p>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="p-3">最深步骤</th>
                  <th>成熟用户</th>
                  <th>占比</th>
                  <th>观察中（暂定）</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, i) => (
                  <tr key={stage} className="border-t">
                    <td className="p-3">{stage}</td>
                    <td>{mature.filter((r) => r.stage === i).length}</td>
                    <td>
                      {mature.length
                        ? (
                            (100 * mature.filter((r) => r.stage === i).length) /
                            mature.length
                          ).toFixed(1) + '%'
                        : '—'}
                    </td>
                    <td>
                      {
                        report.filter((r) => r.observing && r.stage === i)
                          .length
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4">
              点击购买但无 checkout 且记录请求失败：
              {
                mature.filter((r) => r.stage === 4 && r.checkoutFailed).length
              }{' '}
              人。测试账户和配置的测试游客已排除。
            </p>
          </>
        )}
        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">结账跳转与支付结果</h2>
          {payments ? (
            <>
              <p className="text-muted-foreground text-sm">
                按所选日期统计全站结账，不限于 Create
                用户。跳转按尝试去重，离站不等于收银台加载成功；支付结果按实际订单当前状态统计，不以浏览器返回为准。
              </p>
              {truncated && (
                <p role="alert">
                  支付诊断仅展示最近 {MAX_DIAGNOSTICS}{' '}
                  条事件的汇总；请缩短日期范围查看。
                </p>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                <CountTable
                  label="跳转信号（尝试数）"
                  rows={Object.entries(paymentSignalLabels).map(
                    ([key, label]) => ({
                      label,
                      count:
                        payments.signals[
                          key as keyof typeof paymentSignalLabels
                        ],
                    })
                  )}
                />
                <CountTable
                  label="支付结果（订单数）"
                  rows={Object.entries(orderResultLabels).map(
                    ([key, label]) => ({
                      label,
                      count:
                        payments.results[key as keyof typeof orderResultLabels],
                    })
                  )}
                />
              </div>
              {!!payments.returns.length && (
                <CountTable
                  label="浏览器返回状态（尝试数）"
                  rows={payments.returns}
                />
              )}
              <p>
                没有创建订单的失败或异常：
                <strong>{payments.failuresWithoutOrder}</strong> 次尝试
              </p>
              {payments.reasons.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th scope="col" className="p-3">
                          失败或异常原因
                        </th>
                        <th scope="col">有订单（订单数）</th>
                        <th scope="col">无订单（尝试数）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.reasons.map((row) => (
                        <tr key={row.reason} className="border-t">
                          <th scope="row" className="p-3 font-normal">
                            {row.reason === 'unspecified'
                              ? '未记录具体原因'
                              : paymentDiagnosticLabel(row.reason, 'zh')}
                          </th>
                          <td>{row.withOrder}</td>
                          <td>{row.withoutOrder}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-muted-foreground text-sm">
                    同一笔订单或尝试可能出现多种异常，随后仍可能重试成功。
                  </p>
                </div>
              ) : (
                <p>所选日期没有已记录的失败原因。</p>
              )}
            </>
          ) : (
            <p role="alert">支付诊断数据暂不可用。</p>
          )}
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">结果页互动</h2>
          {interactions.length ? (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th scope="col" className="p-3">
                    行为
                  </th>
                  <th scope="col">事件数</th>
                  <th scope="col">去重浏览器数</th>
                </tr>
              </thead>
              <tbody>
                {interactions.map((row) => (
                  <tr key={row.label} className="border-t">
                    <th scope="row" className="p-3 font-normal">
                      {row.label}
                    </th>
                    <td>{row.events}</td>
                    <td>{row.browsers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p role="alert">结果页互动数据暂不可用。</p>
          )}
        </section>
      </Main>
    </>
  );
}

function CountTable({
  label,
  rows,
}: {
  label: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <table className="w-full text-left">
      <caption className="p-3 text-left font-medium">{label}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t">
            <th scope="row" className="p-3 font-normal">
              {row.label}
            </th>
            <td className="pr-3">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
