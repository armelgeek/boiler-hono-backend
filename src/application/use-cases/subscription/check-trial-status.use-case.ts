import { eq } from 'drizzle-orm'
import { IUseCase } from '@/domain/types'
import { ActivityType } from '@/infrastructure/config/activity.config'
import { db } from '@/infrastructure/database/db'
import { users } from '@/infrastructure/database/schema'

export interface CheckTrialStatusArgs {
  userId: string
}

export class CheckTrialStatusUseCase extends IUseCase<CheckTrialStatusArgs, void> {
  async execute({ userId }: CheckTrialStatusArgs): Promise<void> {
    const [user] = await db
      .select({
        isTrialActive: users.isTrialActive,
        trialEndDate: users.trialEndDate,
        stripeSubscriptionId: users.stripeSubscriptionId,
        stripePriceId: users.stripePriceId,
        hasUsedTrial: users.hasUsedTrial
      })
      .from(users)
      .where(eq(users.id, userId))

    if (!user || !user.isTrialActive || !user.trialEndDate) {
      return
    }

    if (user.stripeSubscriptionId && user.stripePriceId) {
      return
    }

    if (user.trialEndDate.getTime() < Date.now()) {
      await db
        .update(users)
        .set({
          isTrialActive: false,
          trialEndDate: null,
          trialStartDate: null,
          hasUsedTrial: true
        })
        .where(eq(users.id, userId))
    }
  }

  log(): ActivityType {
    return ActivityType.GET_SUBSCRIPTION_BY_USER
  }
}
