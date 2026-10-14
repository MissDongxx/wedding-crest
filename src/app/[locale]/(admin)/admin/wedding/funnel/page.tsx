import { gte } from 'drizzle-orm';
import { setRequestLocale } from 'next-intl/server';

import { db } from '@/core/db';
import { PERMISSIONS, requirePermission } from '@/core/rbac';
import {
  order,
  weddingFunnelEvent,
  weddingGeneration,
} from '@/config/db/schema';
import { Header, Main } from '@/shared/blocks/dashboard';
import { classifyFunnel, stages } from '@/shared/wedding/funnel';

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
  let unavailable = false;
  try {
    const events = await db()
      .select()
      .from(weddingFunnelEvent)
      .where(gte(weddingFunnelEvent.createdAt, start));
    const generations = await db()
      .select({
        projectId: weddingGeneration.projectId,
        status: weddingGeneration.status,
        createdAt: weddingGeneration.createdAt,
        updatedAt: weddingGeneration.updatedAt,
      })
      .from(weddingGeneration)
      .where(gte(weddingGeneration.createdAt, start));
    const orders = await db()
      .select({
        projectId: order.projectId,
        productId: order.productId,
        createdAt: order.createdAt,
        checkoutUrl: order.checkoutUrl,
        paymentSessionId: order.paymentSessionId,
      })
      .from(order)
      .where(gte(order.createdAt, start));
    report = classifyFunnel(events, generations, orders, now);
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
      </Main>
    </>
  );
}
