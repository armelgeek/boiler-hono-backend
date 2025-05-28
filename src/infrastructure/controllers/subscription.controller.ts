import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { CancelSubscriptionUseCase } from '@/application/use-cases/subscription/cancel-subscription.use-case'
import { ChangeSubscriptionPlanUseCase } from '@/application/use-cases/subscription/change-subscription.use-case'
import { CreateSubscriptionUseCase } from '@/application/use-cases/subscription/create-subscription.use-case'
import { GetSubscriptionStatusUseCase } from '@/application/use-cases/subscription/get-subscription-status.use-case'
import { HandleStripeWebhookUseCase } from '@/application/use-cases/subscription/handle-stripe-webhook.use-case'
import { stripe } from '../config/stripe.config'

export class SubscriptionController {
  public controller: OpenAPIHono

  constructor() {
    this.controller = new OpenAPIHono()
  }

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/subscription/create',
        tags: ['Subscription'],
        summary: 'Create Stripe subscription',
        description: 'Create a new subscription for a user.',
        security: [{ Bearer: [] }],
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({
                  priceId: z.string(),
                  successUrl: z.string(),
                  cancelUrl: z.string()
                })
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Subscription checkout session created',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  sessionId: z.string()
                })
              }
            }
          },
          400: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  error: z.string()
                })
              }
            }
          }
        }
      }),
      async (c: any) => {
        const user = c.get('user')
        if (!user) {
          return c.json({ success: false, error: 'Unauthorized' }, 401)
        }

        const { priceId, successUrl, cancelUrl } = await c.req.json()

        const createSubscriptionUseCase = new CreateSubscriptionUseCase()
        const result = await createSubscriptionUseCase.execute({
          userId: user.id,
          priceId,
          successUrl,
          cancelUrl
        })

        if (result.success) {
          return c.json({ success: true, sessionId: result.sessionId })
        } else {
          return c.json({ success: false, error: result.error }, 400)
        }
      }
    )
    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/v1/subscription/status',
        tags: ['Subscription'],
        summary: 'Get subscription status',
        description: 'Get the current subscription status and details for a user',
        security: [{ Bearer: [] }],
        responses: {
          200: {
            description: 'Subscription details retrieved successfully',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  data: z.object({
                    isTrialActive: z.boolean(),
                    trialStartDate: z.string().nullable(),
                    trialEndDate: z.string().nullable(),
                    plan: z.object({
                      title: z.string(),
                      description: z.string(),
                      benefits: z.array(z.string()),
                      isPaid: z.boolean(),
                      interval: z.enum(['month', 'year']).nullable(),
                      isCanceled: z.boolean()
                    })
                  })
                })
              }
            }
          }
        }
      }),
      async (c: any) => {
        const user = c.get('user')
        if (!user) {
          return c.json({ success: false, error: 'Unauthorized' }, 401)
        }

        const getSubscriptionStatusUseCase = new GetSubscriptionStatusUseCase()
        try {
          const subscription = await getSubscriptionStatusUseCase.execute({ userId: user.id })
          return c.json({ success: true, data: subscription })
        } catch (error: any) {
          return c.json({ success: false, error: error.message }, 400)
        }
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/stripe/webhook',
        tags: ['Subscription'],
        summary: 'Stripe Webhook',
        description: 'Handle Stripe webhook events.',
        operationId: 'stripeWebhook',
        responses: {
          200: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean()
                })
              }
            }
          }
        }
      }),
      async (ctx: any) => {
        const sig = ctx.req.header('stripe-signature')
        const rawBody = await ctx.req.raw.text()
        try {
          const event = stripe.webhooks.constructEvent(rawBody, sig!, Bun.env.STRIPE_WEBHOOK_SECRET!)

          const handleStripeWebhookUseCase = new HandleStripeWebhookUseCase()
          const result = await handleStripeWebhookUseCase.execute({ event })

          if (result.success) {
            return ctx.json({ success: true })
          } else {
            return ctx.json({ success: false }, 400)
          }
        } catch (error) {
          console.error('[Stripe Webhook Error]', error)
          return ctx.json({ success: false, error: 'Webhook Error' }, 400)
        }
      }
    )
    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/subscription/change',
        tags: ['Subscription'],
        summary: 'Change subscription plan',
        description: 'Change the current subscription plan for the user.',
        security: [{ Bearer: [] }],
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({
                  newPriceId: z.string()
                })
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Subscription plan changed successfully',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean()
                })
              }
            }
          },
          400: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  error: z.string()
                })
              }
            }
          }
        }
      }),
      async (c: any) => {
        const user = c.get('user')
        if (!user) {
          return c.json({ success: false, error: 'Unauthorized' }, 401)
        }

        const { newPriceId } = await c.req.json()

        const changeSubscriptionPlanUseCase = new ChangeSubscriptionPlanUseCase()
        try {
          const result = await changeSubscriptionPlanUseCase.execute({
            userId: user.id,
            newPriceId
          })

          if (result.success) {
            return c.json({ success: true })
          } else {
            return c.json({ success: false, error: result.error }, 400)
          }
        } catch (error: any) {
          return c.json({ success: false, error: error.message }, 400)
        }
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/subscription/cancel',
        tags: ['Subscription'],
        summary: 'Cancel subscription',
        description: 'Cancel the current subscription of the user.',
        security: [{ Bearer: [] }],
        responses: {
          200: {
            description: 'Subscription canceled successfully',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean()
                })
              }
            }
          },
          400: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  error: z.string()
                })
              }
            }
          }
        }
      }),
      async (c: any) => {
        const user = c.get('user')
        if (!user) {
          return c.json({ success: false, error: 'Unauthorized' }, 401)
        }

        const cancelSubscriptionUseCase = new CancelSubscriptionUseCase()
        try {
          const result = await cancelSubscriptionUseCase.execute({
            userId: user.id
          })

          if (result.success) {
            return c.json({ success: true })
          } else {
            return c.json({ success: false, error: result.error }, 400)
          }
        } catch (error: any) {
          return c.json({ success: false, error: error.message }, 400)
        }
      }
    )
  }
}
