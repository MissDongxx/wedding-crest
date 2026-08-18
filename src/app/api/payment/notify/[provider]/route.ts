import {
  PaymentEventType,
  SubscriptionCycleType,
} from '@/extensions/payment/types';
import {
  findOrderByOrderNo,
  findOrderByTransactionId,
} from '@/shared/models/order';
import { findSubscriptionByProviderSubscriptionId } from '@/shared/models/subscription';
import {
  getPaymentService,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/shared/services/payment';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    if (!provider) {
      throw new Error('provider is required');
    }

    const paymentService = await getPaymentService();
    const paymentProvider = paymentService.getProvider(provider);
    if (!paymentProvider) {
      throw new Error('payment provider not found');
    }

    // get payment event from webhook notification
    const event = await paymentProvider.getPaymentEvent({ req });
    if (!event) {
      throw new Error('payment event not found');
    }

    const eventType = event.eventType;
    if (!eventType) {
      throw new Error('event type not found');
    }

    // payment session
    const session = event.paymentSession;
    if (!session) {
      throw new Error('payment session not found');
    }

    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      // one-time payment or subscription first payment
      const orderNo = session.metadata.order_no;

      if (!orderNo) {
        throw new Error('order no not found');
      }

      const order = await findOrderByOrderNo(orderNo);
      if (!order) {
        throw new Error('order not found');
      }

      await handleCheckoutSuccess({
        order,
        session,
      });
    } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
      // handle subscription payment or one-time payment
      if (session.subscriptionId && session.subscriptionInfo) {
        // Find existing subscription in database
        const existingSubscription =
          await findSubscriptionByProviderSubscriptionId({
            provider: provider,
            subscriptionId: session.subscriptionId,
          });

        if (existingSubscription) {
          // Determine if this is a renewal or first payment
          const subscriptionCycleType =
            session.paymentInfo?.subscriptionCycleType;
          const transactionId = session.paymentInfo?.transactionId;

          // Method 1: Use subscriptionCycleType if available (Stripe, Creem, PayPal all provide this)
          if (subscriptionCycleType) {
            if (subscriptionCycleType === SubscriptionCycleType.CREATE) {
              return Response.json({ message: 'success' });
            }

            if (subscriptionCycleType === SubscriptionCycleType.RENEWAL) {
              // Idempotency check: skip if transaction already processed
              if (transactionId) {
                const existingOrder = await findOrderByTransactionId({
                  transactionId,
                  paymentProvider: provider,
                });
                if (existingOrder) {
                  return Response.json({ message: 'success' });
                }
              }

              await handleSubscriptionRenewal({
                subscription: existingSubscription,
                session,
              });
              return Response.json({ message: 'success' });
            }
          }

          // Method 2: Fall back to transactionId-based idempotency check
          // If subscriptionCycleType is not available, check if this transaction already exists
          if (transactionId) {
            const existingOrder = await findOrderByTransactionId({
              transactionId,
              paymentProvider: provider,
            });
            if (existingOrder) {
              return Response.json({ message: 'success' });
            }

            // Transaction not found - treat as renewal (subscription exists but transaction is new)

            await handleSubscriptionRenewal({
              subscription: existingSubscription,
              session,
            });
          } else {
          }
        } else {
          // Subscription not in database - this might be first payment
          // But first payment should be handled via CHECKOUT_SUCCESS or SUBSCRIBE_UPDATED
        }
      } else {
        // handle one-time payment
        const orderNo = session.metadata?.order_no;

        if (!orderNo) {
          return Response.json({ message: 'success' });
        }

        const order = await findOrderByOrderNo(orderNo);
        if (!order) {
          throw new Error('order not found');
        }

        // handleCheckoutSuccess has idempotency check and optimistic lock
        await handleCheckoutSuccess({
          order,
          session,
        });
      }
    } else if (eventType === PaymentEventType.SUBSCRIBE_UPDATED) {
      // only handle subscription update
      if (!session.subscriptionId || !session.subscriptionInfo) {
        throw new Error('subscription id or subscription info not found');
      }

      const existingSubscription =
        await findSubscriptionByProviderSubscriptionId({
          provider: provider,
          subscriptionId: session.subscriptionId,
        });
      if (!existingSubscription) {
        throw new Error('subscription not found');
      }

      await handleSubscriptionUpdated({
        subscription: existingSubscription,
        session,
      });
    } else if (eventType === PaymentEventType.SUBSCRIBE_CANCELED) {
      // only handle subscription cancellation
      if (!session.subscriptionId || !session.subscriptionInfo) {
        throw new Error('subscription id or subscription info not found');
      }

      const existingSubscription =
        await findSubscriptionByProviderSubscriptionId({
          provider: provider,
          subscriptionId: session.subscriptionId,
        });
      if (!existingSubscription) {
        throw new Error('subscription not found');
      }

      await handleSubscriptionCanceled({
        subscription: existingSubscription,
        session,
      });
    } else {
    }

    return Response.json({
      message: 'success',
    });
  } catch (err) {
    return Response.json(
      {
        message: `handle payment notify failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      {
        status: 500,
      }
    );
  }
}
