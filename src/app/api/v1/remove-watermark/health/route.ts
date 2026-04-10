import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * Health check endpoint for iOS Shortcuts connectivity testing.
 * GET /api/v1/remove-watermark/health
 */
export async function GET(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  console.log(`[health] Ping from: ${userAgent.slice(0, 100)}`);

  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: typeof process !== 'undefined' ? 'nodejs' : 'edge',
  });
}
