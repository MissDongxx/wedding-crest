export function respData(data: any) {
  return respJson(0, 'ok', data || []);
}

export function respOk() {
  return respJson(0, 'ok');
}

/**
 * Build a JSON error response. The default HTTP status is 200 to stay
 * compatible with the long-standing "envelope carries the error" pattern
 * used across this codebase, but callers can pass a real 4xx / 5xx code
 * when the situation is a genuine HTTP-level outcome the client should
 * be able to branch on — e.g. 402 Payment Required for a quota-exceeded
 * response, 404 for missing rows, 500 for unhandled server errors.
 */
export function respErr(message: string, status: number = 200, data?: any) {
  return respJson(-1, message, data, status);
}

export function respJson(
  code: number,
  message: string,
  data?: any,
  status: number = 200
) {
  let json: Record<string, unknown> = {
    code: code,
    message: message,
    data: data,
  };
  if (data) {
    json['data'] = data;
  }

  return Response.json(json, { status });
}
