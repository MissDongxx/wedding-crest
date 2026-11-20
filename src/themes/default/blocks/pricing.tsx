'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { PaymentModal } from '@/shared/blocks/payment/payment-modal';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useAppContext } from '@/shared/contexts/app';
import { getCookie } from '@/shared/lib/cookie';
import { cn } from '@/shared/lib/utils';
import { Subscription } from '@/shared/models/subscription';
import {
  PricingCurrency,
  PricingItem,
  Pricing as PricingType,
} from '@/shared/types/blocks/pricing';
import { beginCheckoutAttempt } from '@/shared/wedding/checkout-telemetry-client';
import { WEDDING_PACK_PRODUCT_ID } from '@/shared/wedding/config';
import { requestWeddingCheckout } from '@/shared/wedding/purchase-client';

// Helper function to get all available currencies from a pricing item
function getCurrenciesFromItem(item: PricingItem | null): PricingCurrency[] {
  if (!item) return [];

  // Always include the default currency first
  const defaultCurrency: PricingCurrency = {
    currency: item.currency,
    amount: item.amount,
    price: item.price || '',
    original_price: item.original_price || '',
  };

  // Add additional currencies if available
  if (item.currencies && item.currencies.length > 0) {
    return [defaultCurrency, ...item.currencies];
  }

  return [defaultCurrency];
}

// Helper function to select initial currency based on locale
function getInitialCurrency(
  currencies: PricingCurrency[],
  locale: string,
  defaultCurrency: string
): string {
  if (currencies.length === 0) return defaultCurrency;

  // If locale is 'zh', prefer CNY
  if (locale === 'zh') {
    const cnyCurrency = currencies.find(
      (c) => c.currency.toLowerCase() === 'cny'
    );
    if (cnyCurrency) {
      return cnyCurrency.currency;
    }
  }

  // Otherwise return default currency
  return defaultCurrency;
}

export function Pricing({
  section,
  className,
  currentSubscription,
}: {
  section: PricingType;
  className?: string;
  currentSubscription?: Subscription;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('pages.pricing.messages');

  const {
    user,
    isShowPaymentModal,
    setIsShowSignModal,
    setIsShowPaymentModal,
    configs,
  } = useAppContext();

  const [group, setGroup] = useState(() => {
    // find current pricing item
    const currentItem = section.items?.find(
      (i) => i.product_id === currentSubscription?.productId
    );

    // First look for a group with is_featured set to true
    const featuredGroup = section.groups?.find((g) => g.is_featured);
    // If no featured group exists, fall back to the first group
    return (
      currentItem?.group || featuredGroup?.name || section.groups?.[0]?.name
    );
  });

  // current pricing item
  const [pricingItem, setPricingItem] = useState<PricingItem | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  // Currency state management for each item
  // Store selected currency and displayed item for each product_id
  const [itemCurrencies, setItemCurrencies] = useState<
    Record<string, { selectedCurrency: string; displayedItem: PricingItem }>
  >({});

  // Initialize currency states for all items
  useEffect(() => {
    if (section.items && section.items.length > 0) {
      const initialCurrencyStates: Record<
        string,
        { selectedCurrency: string; displayedItem: PricingItem }
      > = {};

      section.items.forEach((item) => {
        const currencies = getCurrenciesFromItem(item);
        const selectedCurrency = getInitialCurrency(
          currencies,
          locale,
          item.currency
        );

        // Create displayed item with selected currency
        const currencyData = currencies.find(
          (c) => c.currency.toLowerCase() === selectedCurrency.toLowerCase()
        );

        const displayedItem = currencyData
          ? {
              ...item,
              currency: currencyData.currency,
              amount: currencyData.amount,
              price: currencyData.price,
              original_price: currencyData.original_price,
              // Override with currency-specific payment settings if available
              payment_product_id:
                currencyData.payment_product_id || item.payment_product_id,
              payment_providers:
                currencyData.payment_providers || item.payment_providers,
            }
          : item;

        initialCurrencyStates[item.product_id] = {
          selectedCurrency,
          displayedItem,
        };
      });

      setItemCurrencies(initialCurrencyStates);
    }
  }, [section.items, locale]);

  // Handler for currency change
  const handleCurrencyChange = (productId: string, currency: string) => {
    const item = section.items?.find((i) => i.product_id === productId);
    if (!item) return;

    const currencies = getCurrenciesFromItem(item);
    const currencyData = currencies.find(
      (c) => c.currency.toLowerCase() === currency.toLowerCase()
    );

    if (currencyData) {
      const displayedItem = {
        ...item,
        currency: currencyData.currency,
        amount: currencyData.amount,
        price: currencyData.price,
        original_price: currencyData.original_price,
        // Override with currency-specific payment settings if available
        payment_product_id:
          currencyData.payment_product_id || item.payment_product_id,
        payment_providers:
          currencyData.payment_providers || item.payment_providers,
      };

      setItemCurrencies((prev) => ({
        ...prev,
        [productId]: {
          selectedCurrency: currency,
          displayedItem,
        },
      }));
    }
  };

  const handlePayment = async (item: PricingItem) => {
    if (item.product_id === 'wedding_human_design') {
      router.push('/create?service=human');
      return;
    }
    if (item.product_id === 'free') {
      router.push('/create');
      return;
    }
    // Visitors can prepare a design before signing in and purchasing.
    if (!user && item.product_id === WEDDING_PACK_PRODUCT_ID) {
      router.push('/create');
      return;
    }

    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    // Use displayed item with selected currency
    const displayedItem =
      itemCurrencies[item.product_id]?.displayedItem || item;

    if (configs.select_payment_enabled === 'true') {
      setPricingItem(displayedItem);
      setIsShowPaymentModal(true);
    } else {
      handleCheckout(displayedItem, configs.default_payment_provider);
    }
  };

  const getAffiliateMetadata = ({
    paymentProvider,
  }: {
    paymentProvider: string;
  }) => {
    const affiliateMetadata: Record<string, string> = {};

    // get Affonso referral
    if (
      configs.affonso_enabled === 'true' &&
      ['stripe', 'creem'].includes(paymentProvider)
    ) {
      const affonsoReferral = getCookie('affonso_referral') || '';
      affiliateMetadata.affonso_referral = affonsoReferral;
    }

    // get PromoteKit referral
    if (
      configs.promotekit_enabled === 'true' &&
      ['stripe'].includes(paymentProvider)
    ) {
      const promotekitReferral =
        typeof window !== 'undefined' && (window as any).promotekit_referral
          ? (window as any).promotekit_referral
          : getCookie('promotekit_referral') || '';
      affiliateMetadata.promotekit_referral = promotekitReferral;
    }

    return affiliateMetadata;
  };

  const handleCheckout = async (
    item: PricingItem,
    paymentProvider?: string
  ) => {
    try {
      if (!user) {
        setIsShowSignModal(true);
        return;
      }

      const affiliateMetadata = getAffiliateMetadata({
        paymentProvider: paymentProvider || '',
      });

      const params = {
        product_id: item.product_id,
        currency: item.currency,
        locale: locale || 'en',
        payment_provider: paymentProvider || '',
        metadata: affiliateMetadata,
      };

      setIsLoading(true);
      setProductId(item.product_id);

      const telemetry = beginCheckoutAttempt({
        entry: 'pricing',
        provider: paymentProvider,
      });
      const { response, body } = await requestWeddingCheckout(
        () =>
          telemetry.fetch({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
          }),
        () => {},
        undefined,
        telemetry
      );

      if (response.status === 401) {
        setIsLoading(false);
        setProductId(null);
        setPricingItem(null);
        setIsShowSignModal(true);
        return;
      }

      const { code, message, data } = body;
      if (!response.ok) {
        throw new Error(
          message || `request failed with status ${response.status}`
        );
      }
      if (code !== 0) {
        throw new Error(message);
      }

      const checkoutUrl = data?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error('checkout url not found');
      }

      telemetry.redirect(checkoutUrl, () => {
        setIsLoading(false);
        setProductId(null);
        toast.error('The payment page did not open. Please retry.');
      });
    } catch (e: any) {
      console.log('checkout failed: ', e);
      toast.error('checkout failed: ' + e.message);

      setIsLoading(false);
      setProductId(null);
    }
  };

  useEffect(() => {
    if (section.items) {
      const featuredItem = section.items.find((i) => i.is_featured);
      setProductId(featuredItem?.product_id || section.items[0]?.product_id);
      setIsLoading(false);
    }
  }, [section.items]);

  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="mx-auto mb-10 max-w-3xl px-4 text-center md:mb-14 md:px-8">
        {section.sr_only_title && (
          <h1 className="sr-only">{section.sr_only_title}</h1>
        )}
        <h2 className="mb-4 font-serif text-3xl font-medium text-balance lg:text-4xl">
          {section.title}
        </h2>
        <p className="text-muted-foreground mx-auto max-w-2xl text-base leading-relaxed text-pretty">
          {section.description}
        </p>
      </div>

      <div className="container">
        {section.groups && section.groups.length > 1 && (
          <div className="mx-auto mb-10 flex w-full justify-center">
            <Tabs value={group} onValueChange={setGroup}>
              <TabsList>
                {section.groups.map((item, i) => (
                  <TabsTrigger key={i} value={item.name || ''}>
                    {item.title}
                    {item.label && <Badge className="ml-2">{item.label}</Badge>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {section.items?.map((item: PricingItem, idx) => {
            if (item.group && item.group !== group) {
              return null;
            }

            const isCurrentPlan =
              currentSubscription?.productId === item.product_id;
            const currencyState = itemCurrencies[item.product_id];
            const displayedItem = currencyState?.displayedItem || item;
            const selectedCurrency =
              currencyState?.selectedCurrency || item.currency;
            const currencies = getCurrenciesFromItem(item);

            return (
              <Card
                key={idx}
                className={cn(
                  'relative min-w-0 gap-6 shadow-none',
                  item.is_featured ? 'border-primary border-2' : 'border-border'
                )}
              >
                {item.label && (
                  <span className="bg-primary text-foreground dark:text-primary-foreground absolute -top-3 left-6 max-w-[calc(100%-3rem)] rounded-full px-3 py-1 text-center text-xs leading-snug font-semibold">
                    {item.label}
                  </span>
                )}

                <CardHeader className="gap-3">
                  <CardTitle>
                    <h3 className="font-serif text-xl leading-snug font-medium text-balance">
                      {item.title}
                    </h3>
                  </CardTitle>

                  <div className="flex min-h-16 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-foreground font-serif text-4xl leading-tight font-medium tabular-nums">
                      {displayedItem.price}
                    </span>
                    {displayedItem.original_price && (
                      <span className="text-muted-foreground text-sm line-through">
                        {displayedItem.original_price}
                      </span>
                    )}
                    {displayedItem.unit && (
                      <span className="text-muted-foreground text-sm">
                        {displayedItem.unit}
                      </span>
                    )}
                    {currencies.length > 1 && (
                      <Select
                        value={selectedCurrency}
                        onValueChange={(currency) =>
                          handleCurrencyChange(item.product_id, currency)
                        }
                      >
                        <SelectTrigger
                          aria-label="Currency"
                          className="min-h-11 min-w-20 text-sm"
                        >
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem
                              key={currency.currency}
                              value={currency.currency}
                            >
                              {currency.currency.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <CardDescription className="text-sm leading-relaxed text-pretty">
                    {item.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <hr />
                  {item.features_title && (
                    <p className="text-sm font-medium">{item.features_title}</p>
                  )}
                  <ul className="space-y-3 text-sm leading-relaxed">
                    {item.features?.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <Check
                          aria-hidden="true"
                          className="mt-1 size-4 shrink-0"
                        />
                        <span className="min-w-0 break-words">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="mt-auto flex-col items-stretch gap-4">
                  {item.tip && (
                    <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                      {item.tip}
                    </p>
                  )}
                  {isCurrentPlan ? (
                    <Button
                      variant="outline"
                      className="h-auto min-h-11 w-full px-4 py-3 text-sm whitespace-normal"
                      disabled
                    >
                      {t('current_plan')}
                    </Button>
                  ) : (
                    <Button
                      variant={item.is_featured ? 'default' : 'outline'}
                      onClick={() => handlePayment(item)}
                      disabled={isLoading}
                      className={cn(
                        'h-auto min-h-11 w-full px-4 py-3 text-sm leading-snug whitespace-normal',
                        item.is_featured &&
                          'bg-foreground text-background hover:bg-foreground/90'
                      )}
                    >
                      {isLoading && item.product_id === productId ? (
                        <>
                          <Loader2
                            aria-hidden="true"
                            className="size-4 shrink-0 animate-spin"
                          />
                          <span role="status">{t('processing')}</span>
                        </>
                      ) : (
                        <>
                          {item.button?.icon && (
                            <SmartIcon
                              name={item.button.icon as string}
                              className="size-4 shrink-0"
                            />
                          )}
                          <span>{item.button?.title}</span>
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <PaymentModal
        isLoading={isLoading}
        pricingItem={pricingItem}
        onCheckout={(item, paymentProvider) =>
          handleCheckout(item, paymentProvider)
        }
      />
    </section>
  );
}
