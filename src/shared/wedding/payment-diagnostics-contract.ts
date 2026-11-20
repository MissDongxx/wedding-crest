import { z } from 'zod';

export const PAYMENT_CLIENT_STAGES = [
  'clicked',
  'request_failed',
  'session_created',
  'redirect_started',
  'redirect_left',
  'redirect_not_left',
  'returned',
  'access_unconfirmed',
] as const;

export const PAYMENT_CLIENT_REASONS = [
  'network_error',
  'timeout',
  'invalid_response',
  'http_error',
  'checkout_initializing',
  'checkout_ended',
  'invalid_checkout_url',
  'redirect_timeout',
  'redirect_error',
  'returned_paid',
  'returned_prepaid',
  'returned_pending',
  'returned_failed',
  'returned_canceled',
  'returned_access_required',
  'returned_unknown',
  'access_unconfirmed',
  'session_created',
  'redirect_started',
] as const;

export const PAYMENT_ENTRIES = [
  'wizard',
  'result',
  'pricing',
  'human_design',
] as const;

const safeIdentifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);

/** No free-form text, URL, user identity or provider payload crosses this API. */
export const checkoutClientDiagnosticSchema = z
  .object({
    stage: z.enum(PAYMENT_CLIENT_STAGES),
    entry: z.enum(PAYMENT_ENTRIES),
    attemptId: z.string().uuid(),
    requestId: z.string().uuid().optional(),
    orderNo: safeIdentifier.optional(),
    provider: z.enum(['waffo', 'stripe', 'paypal', 'creem']).optional(),
    projectId: safeIdentifier.optional(),
    reason: z.enum(PAYMENT_CLIENT_REASONS).optional(),
    httpStatus: z.number().int().min(100).max(599).optional(),
    latencyMs: z.number().int().min(0).max(120_000).optional(),
  })
  .strict();

export type PaymentClientDiagnosticInput = z.infer<
  typeof checkoutClientDiagnosticSchema
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,100}$/;
const CODE = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;

export const safePaymentUuid = (value: unknown) =>
  typeof value === 'string' && UUID.test(value) ? value : undefined;
export const safePaymentIdentifier = (value: unknown) =>
  typeof value === 'string' && IDENTIFIER.test(value) ? value : undefined;
export const safePaymentCode = (value: unknown) =>
  typeof value === 'string' && CODE.test(value) && !/\d{12}/.test(value)
    ? value
    : undefined;

const ERROR_TYPES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'AbortError',
  'TimeoutError',
  'SyntaxError',
  'ReferenceError',
  'WaffoApiError',
  'WaffoError',
  'ApiError',
  'ZodError',
  'PostgresError',
  'FetchError',
  'DOMException',
]);

export const safePaymentErrorType = (value: unknown) =>
  typeof value === 'string' && ERROR_TYPES.has(value) ? value : undefined;
export const safePaymentErrorCode = (value: unknown) => {
  if (typeof value === 'string' && /^[0-9A-Z]{5}$/.test(value)) return value;
  const code = safePaymentCode(value);
  return code &&
    /^(?:E[A-Z0-9_]{2,28}|UND_ERR_[A-Z_]{1,35}|ERR_[A-Z_]{1,35}|[0-9A-Z]{5})$/.test(
      code
    )
    ? code
    : undefined;
};

/** Canonical platform/bank reasons only; unknown free-form provider text is dropped. */
export function classifyProviderPaymentReason(
  value: unknown
): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const reason = value.trim().toLowerCase();
  const canonical = new Set([
    'insufficient_funds',
    'expired_card',
    'incorrect_cvc',
    'incorrect_card_number',
    'authentication_required',
    'risk_rejected',
    'do_not_honor',
    'card_declined',
    'payment_method_unsupported',
    'canceled',
    'provider_timeout',
    'checkout_expired',
    'provider_error',
    'provider_rejected',
  ]);
  // Provider adapters and persistence both normalize reasons. Already-safe
  // canonical codes must survive that second boundary unchanged.
  if (canonical.has(reason)) return reason;
  const known: Array<[RegExp, string]> = [
    [/insufficient.?fund|balance.?insufficient/, 'insufficient_funds'],
    [/expired.?card|card.?expired/, 'expired_card'],
    [
      /incorrect.?cvc|invalid.?cvc|incorrect.?cvv|invalid.?cvv/,
      'incorrect_cvc',
    ],
    [/incorrect.?number|invalid.?card.?number/, 'incorrect_card_number'],
    [
      /authentication.?required|3.?d.?secure|3ds|authentication.?fail/,
      'authentication_required',
    ],
    [/fraud|risk.?reject|high.?risk/, 'risk_rejected'],
    [/do.?not.?honor|do_not_honor/, 'do_not_honor'],
    [/card.?declin|declined|generic_decline/, 'card_declined'],
    [/not.?supported|unsupported/, 'payment_method_unsupported'],
    [/cancel/, 'canceled'],
    [/timeout|timed.?out/, 'provider_timeout'],
    [/expired/, 'checkout_expired'],
    [/processing.?error|provider.?error|internal.?error/, 'provider_error'],
  ];
  return (
    known.find(([pattern]) => pattern.test(reason))?.[1] ?? 'provider_rejected'
  );
}

export function sanitizePaymentDiagnosticDetails(
  input?: Record<string, string | number | boolean | null>
): Record<string, string | number> | undefined {
  if (!input) return undefined;
  const result: Record<string, string | number> = {};
  const errorType = safePaymentErrorType(input.errorType);
  const errorCode = safePaymentErrorCode(input.errorCode);
  const paymentStatus = safePaymentCode(input.paymentStatus);
  if (errorType) result.errorType = errorType;
  if (errorCode) result.errorCode = errorCode;
  if (
    paymentStatus &&
    [
      'paid',
      'failed',
      'canceled',
      'processing',
      'pending',
      'created',
      'completed',
      'success',
      'succeeded',
      'empty',
      'no_payment_records',
      'query_error',
    ].includes(paymentStatus)
  )
    result.paymentStatus = paymentStatus;
  const providerReason = classifyProviderPaymentReason(input.providerReason);
  if (providerReason) result.providerReason = providerReason;
  if (
    typeof input.httpStatus === 'number' &&
    Number.isInteger(input.httpStatus) &&
    input.httpStatus >= 100 &&
    input.httpStatus <= 599
  )
    result.httpStatus = input.httpStatus;
  return Object.keys(result).length ? result : undefined;
}
