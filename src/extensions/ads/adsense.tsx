import { ReactNode } from 'react';
import Script from 'next/script';

import { AdsConfigs, AdsProvider } from '@/extensions/ads';

/**
 * Google adsense configs
 */
export interface AdsenseConfigs extends AdsConfigs {
  adId: string;
}

/**
 * Google adsense provider
 * @website https://adsense.google.com/
 */
export class AdsenseProvider implements AdsProvider {
  readonly name = 'adsense';

  configs: AdsenseConfigs;

  constructor(configs: AdsenseConfigs) {
    this.configs = configs;
  }

  getHeadScripts(): ReactNode {
    return (
      <Script
        id={`${this.name}-loader`}
        strategy="afterInteractive"
        // AdSense's auto-ads depends on this loader being present on the
        // page; `lazyOnload` would mean ads never appear for users who
        // bounce without interacting, so we keep `afterInteractive` —
        // it loads right after hydration finishes, before the user can
        // scroll, and never blocks the initial paint.
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.configs.adId}`}
        crossOrigin="anonymous"
      />
    );
  }

  getBodyScripts(): ReactNode {
    return null;
  }

  getMetaTags(): ReactNode {
    return (
      <meta
        key={this.name}
        name="google-adsense-account"
        content={this.configs.adId}
      />
    );
  }
}
