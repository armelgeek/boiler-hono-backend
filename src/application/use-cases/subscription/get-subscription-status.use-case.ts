import { eq } from 'drizzle-orm'
import { IUseCase } from '@/domain/types'
import { ActivityType } from '@/infrastructure/config/activity.config'
import { db } from '@/infrastructure/database/db'
import { users } from '@/infrastructure/database/schema'

export class GetSubscriptionStatusUseCase extends IUseCase<{ userId: string }, any> {
  async execute({ userId }: { userId: string }): Promise<any> {
    try {
      const subscription = await db
        .select({
          isTrialActive: users.isTrialActive,
          trialStartDate: users.trialStartDate,
          trialEndDate: users.trialEndDate,
          stripePriceId: users.stripePriceId
        })
        .from(users)
        .where(eq(users.id, userId))
        .then((rows) => rows[0])

      if (!subscription) {
        throw new Error('No subscription data found for user')
      }

      return subscription
    } catch (error) {
      console.error('[Get Stripe Status  Error]', error)
    }
  }
  log(): ActivityType {
    return ActivityType.GET_SUBSCRIBE_STATUS
  }
}
