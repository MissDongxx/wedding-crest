import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@/core/db';
import { paymentDiagnosticEvent } from '@/config/db/schema';
import {
  safePaymentCode,
  safePaymentErrorCode,
  safePaymentErrorType,
  safePaymentIdentifier,
  safePaymentUuid,
  sanitizePaymentDiagnosticDetails,
} from '@/shared/wedding/payment-diagnostics-contract';

export interface PaymentDiagnosticInput {
  source: 'server' | 'provider' | 'client';
  stage: string;
  reason?: string;
  requestId?: string;
  attemptId?: string;
  orderNo?: string;
  provider?: string;
  ownerId?: string;
  projectId?: string;
  entry?: string;
  httpStatus?: number;
  latencyMs?: number;
  details?: Record<string, string | number | boolean | null>;
}

/** Classification only: never persist exception messages, stacks or provider bodies. */
export function classifyPaymentDiagnosticError(error: unknown) {
  const input =
    error && typeof error === 'object'
      ? (error as {
          name?: unknown;
          code?: unknown;
          status?: unknown;
          statusCode?: unknown;
          cause?: { code?: unknown };
        })
      : {};
  const errorCode =
    safePaymentErrorCode(input.code) || safePaymentErrorCode(input.cause?.code);
  const errorType = safePaymentErrorType(input.name);
  const status = input.status ?? input.statusCode;
  const httpStatus =
    typeof status === 'number' && status >= 100 && status <= 599
      ? Math.floor(status)
      : undefined;
  const reason =
    errorType === 'AbortError' ||
    errorType === 'TimeoutError' ||
    /TIMEOUT|TIMEDOUT/.test(errorCode || '')
      ? 'timeout'
      : /ECONN|ENET|EHOST|ENOTFOUND|EAI_AGAIN|FETCH/.test(errorCode || '')
        ? 'network_error'
        : httpStatus
          ? 'provider_http_error'
          : 'internal_error';
  return {
    reason,
    details: {
      ...(errorType ? { errorType } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(httpStatus ? { httpStatus } : {}),
    },
  };
}

async function eventId(event: PaymentDiagnosticInput) {
  if (event.source !== 'client') return crypto.randomUUID();
  // Retries/beacons for the same client stage are idempotent. A new HTTP
  // requestId/reason is a distinct diagnostic, not a second charge.
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      [
        event.ownerId,
        event.attemptId,
        event.stage,
        event.reason,
        event.requestId,
      ].join(':')
    )
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Analytics must not change a payment result. Workers keep writes alive with
 * waitUntil; local Node waits at most 250ms. The underlying operation catches
 * its own rejection, so a timeout never creates an unhandled rejection.
 */
export async function recordPaymentDiagnostic(
  input: PaymentDiagnosticInput
): Promise<void> {
  const stage = safePaymentCode(input.stage);
  if (!stage || !['server', 'provider', 'client'].includes(input.source))
    return;
  const details = sanitizePaymentDiagnosticDetails(input.details);
  const event = {
    source: input.source,
    stage,
    reason: safePaymentCode(input.reason),
    requestId: safePaymentUuid(input.requestId),
    attemptId: safePaymentUuid(input.attemptId),
    orderNo: safePaymentIdentifier(input.orderNo),
    provider: safePaymentCode(input.provider),
    ownerId: safePaymentIdentifier(input.ownerId),
    projectId: safePaymentIdentifier(input.projectId),
    entry: safePaymentCode(input.entry),
    httpStatus:
      typeof input.httpStatus === 'number' &&
      Number.isInteger(input.httpStatus) &&
      input.httpStatus >= 100 &&
      input.httpStatus <= 599
        ? input.httpStatus
        : undefined,
    latencyMs:
      typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs)
        ? Math.max(0, Math.min(120_000, Math.round(input.latencyMs)))
        : undefined,
    details: details ? JSON.stringify(details) : undefined,
    createdAt: new Date(),
  };
  const write = (async () => {
    try {
      await db()
        .insert(paymentDiagnosticEvent)
        .values({ id: await eventId(input), ...event })
        .onConflictDoNothing();
    } catch {
      // No raw exception: a DB error may contain connection strings or SQL.
      console.warn(
        'payment_diagnostic_storage_failed',
        JSON.stringify({
          source: event.source,
          stage: event.stage,
          reason: event.reason,
          orderNo: event.orderNo,
          attemptId: event.attemptId,
        })
      );
    }
  })();
  try {
    const context = getCloudflareContext() as unknown as {
      ctx?: { waitUntil?: (promise: Promise<void>) => void };
    };
    if (context.ctx?.waitUntil) {
      context.ctx.waitUntil(write);
      return;
    }
  } catch {
    /* Node / build has no Worker request context. */
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    write,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 250);
    }),
  ]);
  if (timer) clearTimeout(timer);
}

/** A bounded owner + attempt budget, independent of client-supplied identities. */
export async function canRecordClientPaymentDiagnostic(
  ownerId: string,
  attemptId: string
) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [owner] = await db()
    .select({ total: count() })
    .from(paymentDiagnosticEvent)
    .where(
      and(
        eq(paymentDiagnosticEvent.source, 'client'),
        eq(paymentDiagnosticEvent.ownerId, ownerId),
        gte(paymentDiagnosticEvent.createdAt, hourAgo)
      )
    );
  if (owner.total >= 180) return false;
  const [attempt] = await db()
    .select({ total: count() })
    .from(paymentDiagnosticEvent)
    .where(
      and(
        eq(paymentDiagnosticEvent.source, 'client'),
        eq(paymentDiagnosticEvent.ownerId, ownerId),
        eq(paymentDiagnosticEvent.attemptId, attemptId),
        gte(paymentDiagnosticEvent.createdAt, hourAgo)
      )
    );
  return attempt.total < 30;
}

export type PaymentDiagnostic = typeof paymentDiagnosticEvent.$inferSelect;

/** Admin caller enforces payment-view permission; this helper never exposes provider bodies. */
export async function getPaymentDiagnosticsForOrders(
  orderNos: string[]
): Promise<PaymentDiagnostic[]> {
  const safeOrders = [
    ...new Set(
      orderNos
        .map(safePaymentIdentifier)
        .filter((value): value is string => !!value)
    ),
  ].slice(0, 50);
  if (!safeOrders.length) return [];
  try {
    const { asc, inArray, or } = await import('drizzle-orm');
    const direct: PaymentDiagnostic[] = await db()
      .select()
      .from(paymentDiagnosticEvent)
      .where(inArray(paymentDiagnosticEvent.orderNo, safeOrders))
      .orderBy(asc(paymentDiagnosticEvent.createdAt))
      .limit(1000);
    const attemptOwners = direct.filter(
      (event) => event.attemptId && event.ownerId
    );
    if (!attemptOwners.length) return direct;
    // Keep order-less clicked/request_failed events on the same attempt visible.
    return await db()
      .select()
      .from(paymentDiagnosticEvent)
      .where(
        or(
          inArray(paymentDiagnosticEvent.orderNo, safeOrders),
          ...attemptOwners.map((event) =>
            and(
              eq(paymentDiagnosticEvent.attemptId, event.attemptId!),
              eq(paymentDiagnosticEvent.ownerId, event.ownerId!)
            )
          )
        )
      )
      .orderBy(asc(paymentDiagnosticEvent.createdAt))
      .limit(1000);
  } catch {
    return [];
  }
}
