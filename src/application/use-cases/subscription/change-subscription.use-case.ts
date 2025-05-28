import { eq } from 'drizzle-orm'
import { IUseCase } from '@/domain/types'
import { ActivityType } from '@/infrastructure/config/activity.config'
import { stripe } from '@/infrastructure/config/stripe.config'
import { db } from '@/infrastructure/database/db'
import { users } from '@/infrastructure/database/schema'

type Params = {
  userId: string
  newPriceId: string
}

type Response = {
  success: boolean
  error?: string
}

export class ChangeSubscriptionPlanUseCase extends IUseCase<Params, Response> {
  async execute({ userId, newPriceId }: Params): Promise<Response> {
    try {
      const userData = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .then((rows) => rows[0])

      if (!userData) {
        return { success: false, error: 'User not found' }
      }

      const subscriptionId = userData.stripeSubscriptionId
      if (!subscriptionId) {
        return { success: false, error: 'No active subscription found for the user' }
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      if (!subscription) {
        return { success: false, error: 'Subscription not found' }
      }
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
        proration_behavior: 'create_prorations',
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId
          }
        ]
      })
      await db.update(users).set({ stripePriceId: newPriceId }).where(eq(users.id, userId))

      return { success: true }
    } catch (error) {
      console.error('[Change Plan Error]', error)
      return { success: false, error: 'Error changing plan' }
    }
  }

  log(): ActivityType {
    return ActivityType.CHANGE_SUBSCRIPTION_PLAN
  }
}
