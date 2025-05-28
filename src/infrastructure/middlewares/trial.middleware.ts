import { CheckTrialStatusUseCase } from '@/application/use-cases/subscription/check-trial-status.use-case'
import { GetUserSubscriptionByUserUseCase } from '@/application/use-cases/subscription/get-subscription-by-user.use-case'
import type { Context, Next } from 'hono'

export const checkTrialStatus = async (c: Context, next: Next) => {
  const user = c.get('user')

  if (user) {
    const checkTrialStatusUseCase = new CheckTrialStatusUseCase()
    await checkTrialStatusUseCase.run({
      userId: user.id,
      currentUserId: user.id
    })
  }

  await next()
}

export const requireActiveSubscription = async (c: Context, next: Next) => {
  const user = c.get('user')

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }

  try {
    const getUserSubscriptionByUserUseCase = new GetUserSubscriptionByUserUseCase()
    await getUserSubscriptionByUserUseCase.run({
      userId: user.id,
      currentUserId: user.id
    })
  } catch {
    return c.json(
      {
        success: false,
        error: 'Active subscription required',
        needsSubscription: true
      },
      403
    )
  }

  await next()
}

export default { checkTrialStatus, requireActiveSubscription }
