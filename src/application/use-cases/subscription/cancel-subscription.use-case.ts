import { eq } from 'drizzle-orm'
import { IUseCase } from '@/domain/types'
import { ActivityType } from '@/infrastructure/config/activity.config'
import { stripe } from '@/infrastructure/config/stripe.config'
import { db } from '@/infrastructure/database/db'
import { users } from '@/infrastructure/database/schema'

type Params = {
  userId: string
}

type Response = {
  success: boolean
  error?: string
}

export class CancelSubscriptionUseCase extends IUseCase<Params, Response> {
  async execute({ userId }: Params): Promise<Response> {
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

      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      })
      await db.update(users).set({ stripeSubscriptionId: null }).where(eq(users.id, userId))

      return { success: true }
    } catch (error) {
      console.error('[Cancel Subscription Error]', error)
      return { success: false, error: 'Error cancelling subscription' }
    }
  }

  log(): ActivityType {
    return ActivityType.CANCEL_SUBSCRIPTION
  }
}
