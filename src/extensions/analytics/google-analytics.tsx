import { ReactNode } from 'react';
import Script from 'next/script';

import { AnalyticsConfigs, AnalyticsProvider } from '.';

/**
 * Google analytics configs
 * @docs https://marketingplatform.google.com/about/analytics/
 */
export interface GoogleAnalyticsConfigs extends AnalyticsConfigs {
  gaId: string; // google analytics id
}

/**
 * Google analytics provider
 * @website https://marketingplatform.google.com/about/analytics/
 */
export class GoogleAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'google-analytics';

  configs: GoogleAnalyticsConfigs;

  constructor(configs: GoogleAnalyticsConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <>
        {/* Google tag (gtag.js) — analytics only, never on the
            critical path. `lazyOnload` waits for the browser to be
            idle, which is fine for page-view tracking (a few seconds
            of delay is invisible in the GA dashboard). */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${this.configs.gaId}`}
          strategy="lazyOnload"
          async
        />
        <Script
          id={this.name}
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${this.configs.gaId}');
            `,
          }}
        />
      </>
    );
  }
}
