import { cookies } from 'next/headers';

import { loadMessages } from '@/core/i18n/request';
import {
  PaymentInterval,
  PaymentOrder,
  PaymentPrice,
  PaymentType,
} from '@/extensions/payment/types';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { getAllConfigs } from '@/shared/models/config';
import {
  createOrder,
  NewOrder,
  OrderStatus,
  reserveWeddingCheckoutOrder,
  updateOrderByOrderNo,
} from '@/shared/models/order';
import {
  canAccessWeddingProject,
  getWeddingProject,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingProjectOwner,
} from '@/shared/models/wedding-actor';
import {
  ensureWeddingGuestBuyer,
  weddingCheckoutCookie,
} from '@/shared/models/wedding-checkout';
import { getPaymentService } from '@/shared/services/payment';
import { PricingCurrency } from '@/shared/types/blocks/pricing';
import {
  weddingCheckoutId,
  weddingCheckoutReturnUrl,
} from '@/shared/wedding/checkout-contract';
import {
  HUMAN_DESIGN_AMOUNT,
  HUMAN_DESIGN_PRODUCT_ID,
  isWeddingCheckoutProduct,
} from '@/shared/wedding/config';
import { humanDesignCheckoutSchema } from '@/shared/wedding/human-design';

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (
      (origin && origin !== new URL(req.url).origin) ||
      req.headers.get('sec-fetch-site') === 'cross-site'
    )
      return respErr('invalid checkout origin', 403);
    const { product_id, currency, locale, payment_provider, metadata } =
      await req.json();
    if (!product_id) {
      return respErr('product_id is required');
    }

    // Load pricing config directly instead of using getTranslations.
    // getTranslations relies on next-intl middleware context which is not
    // available in API routes (middleware matcher excludes /api).
    // In Cloudflare Workers this causes the request to hang indefinitely.
    const pricingMessages = await loadMessages('pages/pricing', locale || 'en');
    const pricing = pricingMessages?.page?.sections?.pricing;

    if (!pricing || !pricing.items) {
      return respErr('pricing configuration not found');
    }

    const pricingItem = pricing.items.find(
      (item: any) => item.product_id === product_id
    );

    if (!pricingItem) {
      return respErr('pricing item not found');
    }

    if (!pricingItem.product_id && !pricingItem.amount) {
      return respErr('invalid pricing item');
    }

    const isHumanDesign = product_id === HUMAN_DESIGN_PRODUCT_ID;
    const humanRequest = isHumanDesign
      ? humanDesignCheckoutSchema.safeParse(metadata?.human_design ?? {})
      : undefined;
    if (isHumanDesign && !humanRequest?.success)
      return respErr('Invalid design context.', 400);
    if (isHumanDesign) {
      pricingItem.amount = HUMAN_DESIGN_AMOUNT;
      pricingItem.currency = 'USD';
    }
    const actor = await getWeddingActor({
      createGuest: isWeddingCheckoutProduct(product_id),
    });
    const user = actor.user;
    const guestId = req.headers.get('x-wedding-guest-id') || undefined;
    const isWeddingPack = isWeddingCheckoutProduct(product_id);
    const projectId =
      typeof metadata?.project_id === 'string'
        ? metadata.project_id
        : undefined;
    let projectOwnerId: string | undefined;
    if (isWeddingPack && projectId) {
      const project = await getWeddingProject(projectId);
      projectOwnerId = project
        ? getWeddingProjectOwner(actor, project)
        : undefined;
      if (
        !projectId ||
        !(await canAccessWeddingProject({
          id: projectId,
          userId: projectOwnerId,
          guestId,
        }))
      ) {
        return respErr('project not found', 404);
      }
    }
    if (!isWeddingPack && !user?.email)
      return respErr('Sign in to continue checkout.', 401);
    if (isWeddingPack && !user && !actor.guestToken)
      return respErr('checkout identity required', 401);

    // get configs
    const configs = await getAllConfigs();

    // choose payment provider
    let paymentProviderName = isHumanDesign ? 'waffo' : payment_provider || '';
    if (!paymentProviderName) {
      paymentProviderName = configs.default_payment_provider;
    }
    if (!paymentProviderName) {
      return respErr('no payment provider configured');
    }

    // Validate payment provider against allowed providers
    // First check currency-specific payment_providers if currency is provided
    let allowedProviders: string[] | undefined;

    if (
      currency &&
      currency.toLowerCase() !== (pricingItem.currency || 'usd').toLowerCase()
    ) {
      const selectedCurrencyData = pricingItem.currencies?.find(
        (c: PricingCurrency) =>
          c.currency.toLowerCase() === currency.toLowerCase()
      );
      allowedProviders = selectedCurrencyData?.payment_providers;
    }

    // Fallback to default payment_providers if not found in currency config
    if (!allowedProviders || allowedProviders.length === 0) {
      allowedProviders = pricingItem.payment_providers;
    }

    // If payment_providers is configured, validate the selected provider
    if (allowedProviders && allowedProviders.length > 0) {
      if (!allowedProviders.includes(paymentProviderName)) {
        return respErr(
          `payment provider ${paymentProviderName} is not supported for this currency`
        );
      }
    }

    // get default payment provider
    // The wedding pack's promotional amount comes from the server pricing
    // table, not the provider's (potentially stale) catalog price.
    const paymentService = await getPaymentService(
      isWeddingPack && paymentProviderName === 'waffo'
        ? {
            ...configs,
            waffo_price_mode: 'snapshot',
            waffo_tax_category: configs.waffo_tax_category || 'digital_goods',
          }
        : configs
    );

    const paymentProvider = paymentService.getProvider(paymentProviderName);
    if (!paymentProvider || !paymentProvider.name) {
      return respErr('no payment provider configured');
    }

    // checkout currency and amount - calculate from server-side data only (never trust client input)
    // Security: currency can be provided by frontend, but amount must be calculated server-side
    const defaultCurrency = (pricingItem.currency || 'usd').toLowerCase();
    let checkoutCurrency = defaultCurrency;
    let checkoutAmount = pricingItem.amount;

    // If currency is provided, validate it and find corresponding amount from server-side data
    if (currency) {
      const requestedCurrency = currency.toLowerCase();

      // Check if requested currency is the default currency
      if (requestedCurrency === defaultCurrency) {
        checkoutCurrency = defaultCurrency;
        checkoutAmount = pricingItem.amount;
      } else if (pricingItem.currencies && pricingItem.currencies.length > 0) {
        // Find amount for the requested currency in currencies list
        const selectedCurrencyData = pricingItem.currencies.find(
          (c: PricingCurrency) => c.currency.toLowerCase() === requestedCurrency
        );
        if (selectedCurrencyData) {
          // Valid currency found, use it
          checkoutCurrency = requestedCurrency;
          checkoutAmount = selectedCurrencyData.amount;
        }
        // If currency not found in list, fallback to default (already set above)
      }
      // If no currencies list exists, fallback to default (already set above)
    }

    // get payment interval
    const paymentInterval: PaymentInterval =
      pricingItem.interval || PaymentInterval.ONE_TIME;

    // get payment type
    const paymentType =
      paymentInterval === PaymentInterval.ONE_TIME
        ? PaymentType.ONE_TIME
        : PaymentType.SUBSCRIPTION;

    if (isWeddingPack && paymentType !== PaymentType.ONE_TIME)
      return respErr('invalid wedding payment type', 400);
    const buyerId =
      projectOwnerId ||
      user?.id ||
      (await ensureWeddingGuestBuyer(actor.guestToken!));
    const requestId = req.headers.get('x-wedding-checkout-id');
    if (
      requestId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        requestId
      )
    )
      return respErr('invalid checkout request id', 400);
    const checkoutId = isWeddingPack
      ? await weddingCheckoutId(
          isHumanDesign ? `${buyerId}:human-design` : buyerId,
          requestId || getUuid()
        )
      : undefined;
    const orderNo = checkoutId ? `wc_${checkoutId.slice(0, 28)}` : getSnowId();

    // get payment product id from pricing table in local file
    // First try to get currency-specific payment_product_id
    let paymentProductId = '';

    // If currency is provided and different from default, check currency-specific payment_product_id
    if (currency && currency.toLowerCase() !== defaultCurrency) {
      const selectedCurrencyData = pricingItem.currencies?.find(
        (c: PricingCurrency) =>
          c.currency.toLowerCase() === currency.toLowerCase()
      );
      if (selectedCurrencyData?.payment_product_id) {
        paymentProductId = selectedCurrencyData.payment_product_id;
      }
    }

    // Fallback to default payment_product_id if not found in currency config
    if (!paymentProductId) {
      paymentProductId = pricingItem.payment_product_id || '';
    }

    // If still not found, get from payment provider's config
    if (!paymentProductId) {
      paymentProductId = await getPaymentProductId(
        pricingItem.product_id,
        paymentProviderName,
        checkoutCurrency
      );
    }

    // get preset promotion code for product_id
    const promotionCode = await getPromotionCode(
      product_id,
      paymentProviderName,
      checkoutCurrency
    );

    // build checkout price with correct amount for selected currency
    const checkoutPrice: PaymentPrice = {
      amount: checkoutAmount,
      currency: checkoutCurrency,
    };

    if (!paymentProductId) {
      // checkout price validation
      if (!checkoutPrice.amount || !checkoutPrice.currency) {
        return respErr('invalid checkout price');
      }
    } else {
      paymentProductId = paymentProductId.trim();
    }

    let callbackBaseUrl = `${configs.app_url}`;
    if (locale && locale !== configs.default_locale) {
      callbackBaseUrl += `/${locale}`;
    }

    const callbackUrl = isHumanDesign
      ? `${callbackBaseUrl}/human-design?order_no=${encodeURIComponent(orderNo)}`
      : isWeddingPack
        ? weddingCheckoutReturnUrl({
            appUrl: configs.app_url,
            locale,
            defaultLocale: configs.default_locale,
            resumePath: metadata?.resume_path,
            projectId,
            resumeWizard: metadata?.resume_wizard === true,
          })
        : paymentType === PaymentType.SUBSCRIPTION
          ? `${callbackBaseUrl}/settings/billing`
          : `${callbackBaseUrl}/settings/payments`;

    // build checkout order
    const checkoutOrder: PaymentOrder = {
      orderNo,
      description: pricingItem.product_name,
      customer: user ? { name: user.name, email: user.email } : undefined,
      type: paymentType,
      metadata: {
        ...(isHumanDesign
          ? { human_design: humanRequest!.data, fulfillment: 'human_design' }
          : metadata || {}),
        app_name: configs.app_name,
        order_no: orderNo,
        user_id: buyerId,
        ...(isWeddingPack && projectId ? { project_id: projectId } : {}),
      },
      successUrl: `${configs.app_url}/api/payment/callback?order_no=${orderNo}`,
      // Record an explicit buyer cancellation before returning to pricing.
      // Without this callback, canceled and abandoned checkouts both remain
      // indistinguishable in the `created` state.
      cancelUrl: `${configs.app_url}/api/payment/cancel?order_no=${orderNo}`,
    };

    // checkout with predefined product
    if (paymentProductId) {
      checkoutOrder.productId = paymentProductId;
    }

    // checkout dynamically
    checkoutOrder.price = checkoutPrice;
    if (paymentType === PaymentType.SUBSCRIPTION) {
      // subscription mode
      checkoutOrder.plan = {
        interval: paymentInterval,
        name: pricingItem.product_name,
      };
    } else {
      // one-time mode
    }

    if (promotionCode) {
      checkoutOrder.discount = {
        code: promotionCode,
      };
    }

    const currentTime = new Date();

    // build order info
    const order: NewOrder = {
      id: checkoutId || getUuid(),
      orderNo: orderNo,
      userId: buyerId,
      projectId: isWeddingPack ? (projectId ?? null) : null,
      userEmail: user?.email || '',
      status: OrderStatus.PENDING,
      amount: checkoutAmount, // use the amount for selected currency
      currency: checkoutCurrency,
      productId: pricingItem.product_id,
      paymentType: paymentType,
      paymentInterval: paymentInterval,
      paymentProvider: paymentProvider.name,
      checkoutInfo: JSON.stringify(checkoutOrder),
      createdAt: currentTime,
      productName: pricingItem.product_name,
      description: pricingItem.description,
      callbackUrl: callbackUrl,
      creditsAmount: pricingItem.credits,
      creditsValidDays: pricingItem.valid_days,
      planName: pricingItem.plan_name || '',
      paymentProductId: paymentProductId,
      discountCode: promotionCode,
    };

    // Reserve before provider I/O: concurrent retries reuse one provider session.
    if (isWeddingPack) {
      const reservation = await reserveWeddingCheckoutOrder(order);
      if (!reservation.created) {
        const previous = reservation.order;
        if (previous.status === OrderStatus.PAID)
          return respData({
            checkoutUrl: previous.callbackUrl || callbackUrl,
            paid: true,
          });
        if (previous.status === OrderStatus.CREATED && previous.checkoutUrl)
          return respData({
            checkoutUrl: previous.checkoutUrl,
            sessionId: previous.paymentSessionId,
            reused: true,
          });
        if (previous.status === OrderStatus.PENDING)
          return respErr(
            'Checkout is being prepared. Retry shortly using the same request.',
            409,
            { reasonCode: 'checkout_initializing' }
          );
        return respErr('This checkout has ended. Start a new checkout.', 409, {
          reasonCode: 'checkout_ended',
        });
      }
    } else await createOrder(order);

    try {
      // create payment
      const result = await paymentProvider.createPayment({
        order: checkoutOrder,
      });

      // update order status to created, waiting for payment
      await updateOrderByOrderNo(
        orderNo,
        {
          status: OrderStatus.CREATED, // means checkout created, waiting for payment
          checkoutInfo: JSON.stringify(
            isHumanDesign ? checkoutOrder : result.checkoutParams
          ),
          checkoutResult: JSON.stringify(result.checkoutResult),
          checkoutUrl: result.checkoutInfo.checkoutUrl,
          paymentSessionId: result.checkoutInfo.sessionId,
          paymentProvider: result.provider,
        },
        isWeddingPack ? { expectedStatus: OrderStatus.PENDING } : undefined
      );

      if (!user && guestId && projectId) {
        (await cookies()).set(weddingCheckoutCookie(orderNo), guestId, {
          httpOnly: true,
          secure: new URL(req.url).protocol === 'https:',
          sameSite: 'lax',
          path: '/api/payment',
          maxAge: 60 * 60 * 24,
        });
      }
      return respData(result.checkoutInfo);
    } catch (e: any) {
      console.error('PayPal checkout creation failed:', e);
      // update order status to completed, means checkout failed
      await updateOrderByOrderNo(
        orderNo,
        {
          status: OrderStatus.COMPLETED, // means checkout failed
          checkoutInfo: JSON.stringify(checkoutOrder),
        },
        isWeddingPack ? { expectedStatus: OrderStatus.PENDING } : undefined
      );

      return respErr('checkout failed: ' + e.message);
    }
  } catch (e: any) {
    console.error('Checkout route error:', e);
    return respErr('checkout failed: ' + e.message);
  }
}

// get payemt product id from payment provider's config
async function getPaymentProductId(
  productId: string,
  provider: string,
  checkoutCurrency: string
) {
  // Map the local pricing product_id to the provider-side product id. Each
  // provider keeps its own mapping because the ids are not interchangeable —
  // sending a Creem id to Waffo (or vice versa) fails checkout.
  const configKey =
    provider === 'creem'
      ? 'creem_product_ids'
      : provider === 'waffo'
        ? 'waffo_product_ids'
        : '';

  if (!configKey) {
    return;
  }

  try {
    const configs = await getAllConfigs();
    const productIds = configs[configKey];
    if (productIds) {
      const mapping = JSON.parse(productIds);
      return mapping[`${productId}_${checkoutCurrency}`] || mapping[productId];
    }
  } catch {
    return;
  }
}

// get promotion code from payment provider's config
async function getPromotionCode(
  productId: string,
  provider: string,
  checkoutCurrency: string
) {
  if (provider !== 'stripe') {
    // currently only stripe supports promotion code mapping
    return;
  }

  try {
    const configs = await getAllConfigs();
    const stripePromotionCodes = configs.stripe_promotion_codes;
    if (stripePromotionCodes) {
      const promotionCodes = JSON.parse(stripePromotionCodes);
      return (
        promotionCodes[`${productId}_${checkoutCurrency}`] ||
        promotionCodes[productId]
      );
    }
  } catch {
    return;
  }
}
