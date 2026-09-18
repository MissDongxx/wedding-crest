import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/core/i18n/config';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonicalise www → apex so link equity consolidates on a single host.
  // http → https is enforced at the Cloudflare edge ("Always Use HTTPS"),
  // which the Worker cannot reliably observe on its own. Path + query are
  // preserved.
  const host = request.headers.get('host') || '';
  const apexHost = 'weddingcrestdesign.com';
  if (host === `www.${apexHost}`) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = apexHost;
    return NextResponse.redirect(url, 301);
  }

  // Localized homepages (/zh, /ko, ...) no longer exist — only the English
  // homepage is served. The homepage route is `force-static` with
  // `dynamicParams = false`, so any other locale would 404; redirect those
  // root URLs to the canonical homepage so already-indexed URLs consolidate
  // instead of dropping out of the index.
  const rootLocaleMatch = /^\/([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)$/.exec(pathname);
  if (
    rootLocaleMatch &&
    routing.locales.includes(rootLocaleMatch[1] as any) &&
    rootLocaleMatch[1] !== routing.defaultLocale
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url, 308);
  }

  // Handle internationalization first
  const intlResponse = intlMiddleware(request);

  // Extract locale from pathname
  const locale = pathname.split('/')[1];
  const isValidLocale = routing.locales.includes(locale as any);
  const pathWithoutLocale = isValidLocale
    ? pathname.slice(locale.length + 1)
    : pathname;

  // Only check authentication for admin routes
  if (
    pathWithoutLocale.startsWith('/admin') ||
    pathWithoutLocale.startsWith('/settings') ||
    pathWithoutLocale.startsWith('/activity')
  ) {
    // Check if session cookie exists
    const sessionCookie = getSessionCookie(request);

    // If no session token found, redirect to sign-in
    if (!sessionCookie) {
      const signInUrl = new URL(
        isValidLocale ? `/${locale}/sign-in` : '/sign-in',
        request.url
      );
      // Add the current path (including search params) as callback - use relative path for multi-language support
      const callbackPath = pathWithoutLocale + request.nextUrl.search;
      signInUrl.searchParams.set('callbackUrl', callbackPath);
      return NextResponse.redirect(signInUrl);
    }

    // For admin routes, we need to check RBAC permissions
    // Note: Full permission check happens in the page/API route level
    // This is a lightweight session check to prevent unauthorized access
    // The detailed permission check (admin.access and specific permissions)
    // will be done in the layout or individual pages using requirePermission()
  }

  try {
    if (intlResponse) {
      intlResponse.headers.set('x-pathname', request.nextUrl.pathname);
      intlResponse.headers.set('x-url', request.url);

      // Remove Set-Cookie from public pages to allow caching
      // We exclude admin, settings, activity, and auth pages from this behavior
      if (
        !pathWithoutLocale.startsWith('/admin') &&
        !pathWithoutLocale.startsWith('/settings') &&
        !pathWithoutLocale.startsWith('/activity') &&
        !pathWithoutLocale.startsWith('/sign-') &&
        !pathWithoutLocale.startsWith('/auth')
      ) {
        intlResponse.headers.delete('Set-Cookie');

        // Cache-Control header for public pages
        const cacheControl =
          'public, s-maxage=3600, stale-while-revalidate=14400';

        intlResponse.headers.set('Cache-Control', cacheControl);
        intlResponse.headers.set('CDN-Cache-Control', cacheControl);
        intlResponse.headers.set('Cloudflare-CDN-Cache-Control', cacheControl);
      }
    }
  } catch (error) {
    console.error('Middleware header error:', error);
  }

  // For all other routes (including /, /sign-in, /sign-up, /sign-out), just return the intl response
  return intlResponse || NextResponse.next();
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
