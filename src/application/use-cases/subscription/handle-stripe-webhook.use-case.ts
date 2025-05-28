import { eq } from 'drizzle-orm'
import { IUseCase } from '@/domain/types'
import { ActivityType } from '@/infrastructure/config/activity.config'
import { emailTemplates, sendEmail } from '@/infrastructure/config/mail.config'
import { stripe } from '@/infrastructure/config/stripe.config'
import { db } from '@/infrastructure/database/db'
import { users } from '@/infrastructure/database/schema'
import type Stripe from 'stripe'

export class HandleStripeWebhookUseCase extends IUseCase<{ event: Stripe.Event }, { success: boolean }> {
  async execute({ event }: { event: Stripe.Event }): Promise<{ success: boolean }> {
    try {
      let user
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any
          if (session.subscription && session.customer) {
            const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription)
            user = await db
              .select()
              .from(users)
              .where(eq(users.id, session.metadata?.userId))
              .then((rows) => rows[0])

            await db
              .update(users)
              .set({
                stripeSubscriptionId: session.subscription,
                stripeCustomerId: session.customer,
                stripePriceId: stripeSubscription.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
              })
              .where(eq(users.id, session.metadata?.userId))

            const emailTemplate = await emailTemplates.subscriptionCreated(user.name, 'Pro')
            await sendEmail({
              to: user.email,
              ...emailTemplate
            })
          }
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as any
          if (invoice.subscription) {
            user = await db
              .select()
              .from(users)
              .where(eq(users.stripeSubscriptionId, invoice.subscription))
              .then((rows) => rows[0])

            const emailTemplate = await emailTemplates.paymentFailed(user.name)
            await sendEmail({
              to: user.email,
              ...emailTemplate
            })
          }
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription
          const stripeCustomerId = subscription.customer as string
          const subscriptionId = subscription.id
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000)
          const priceId = subscription.items.data[0]?.price.id

          const user = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, stripeCustomerId))
            .then((rows) => rows[0])

          await db
            .update(users)
            .set({
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              stripeCurrentPeriodEnd: currentPeriodEnd
            })
            .where(eq(users.id, user.id))

          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          const stripeCustomerId = subscription.customer as string

          const user = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, stripeCustomerId))
            .then((rows) => rows[0])

          await db
            .update(users)
            .set({
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null
            })
            .where(eq(users.id, user.id))

          break
        }
      }

      return { success: true }
    } catch (error) {
      console.error(error)
      return { success: false }
    }
  }
  log(): ActivityType {
    return ActivityType.CALL_WEBHOOK
  }
}
