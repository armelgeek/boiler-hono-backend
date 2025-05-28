import { eq } from 'drizzle-orm'
import { IUseCase } from '@/domain/types'
import { ActivityType } from '@/infrastructure/config/activity.config'
import { FREE_TRIAL_DAYS, stripe } from '@/infrastructure/config/stripe.config'
import { db } from '@/infrastructure/database/db'
import { users } from '@/infrastructure/database/schema'
type CreateSubscriptionParams = {
  userId: string
  priceId: string
  successUrl: string
  cancelUrl: string
}
type CreateSubscriptionResponse = {
  success: boolean
  sessionId?: string
  error?: string
}
export class CreateSubscriptionUseCase extends IUseCase<CreateSubscriptionParams, CreateSubscriptionResponse> {
  async execute({
    userId,
    priceId,
    successUrl,
    cancelUrl
  }: {
    userId: string
    priceId: string
    successUrl: string
    cancelUrl: string
  }): Promise<CreateSubscriptionResponse> {
    try {
      const userData = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .then((rows) => rows[0])

      if (!userData) {
        return { success: false, error: 'User not found' }
      }

      let customerId = userData.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userData.email,
          name: userData.name
        })

        customerId = customer.id

        await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId))
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        metadata: {
          userId
        },
        subscription_data: {
          trial_period_days: FREE_TRIAL_DAYS
        },
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl
      })

      return { success: true, sessionId: session.id }
    } catch (error) {
      console.error('[Stripe Checkout Error]', error)
      return { success: false, error: 'Error occured' }
    }
  }
  log(): ActivityType {
    return ActivityType.SUBSCRIBING
  }
}
