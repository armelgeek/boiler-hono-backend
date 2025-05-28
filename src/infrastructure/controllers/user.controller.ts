import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { GetUserSubscriptionByUserUseCase } from '@/application/use-cases/subscription/get-subscription-by-user.use-case'
import { absoluteUrl } from '../config/stripe.config'
import { UserRepository } from '../repositories/user.repository'
import type { Routes } from '../../domain/types'
import type Stripe from 'stripe'

export class UserController implements Routes {
  public controller: OpenAPIHono
  private userRepository: UserRepository

  constructor() {
    this.controller = new OpenAPIHono()
    this.userRepository = new UserRepository()
  }

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/v1/users/session',
        tags: ['User'],
        summary: 'Retrieve the user session information',
        description: 'Retrieve the session info of the currently logged in user.',
        operationId: 'getUserSession',
        responses: {
          200: {
            description: 'Session information successfully retrieved',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean().openapi({
                    description: 'Indicates whether the operation was successful',
                    type: 'boolean',
                    example: true
                  }),
                  data: z.object({
                    user: z.object({
                      id: z.string().openapi({
                        description: 'User identifier',
                        type: 'string',
                        example: 'user_ABC123'
                      }),
                      name: z.string().openapi({
                        description: 'User name',
                        type: 'string',
                        example: 'Armel Wanes'
                      }),
                      email: z.string().openapi({
                        description: 'User email',
                        type: 'string',
                        example: 'armelgeek5@gmail.com'
                      }),
                      emailVerified: z.boolean().openapi({
                        description: 'User email verification status',
                        type: 'boolean',
                        example: false
                      }),
                      image: z.string().nullable().openapi({
                        description: 'User image URL',
                        type: 'string',
                        example: null
                      }),
                      createdAt: z.string().openapi({
                        description: 'User creation timestamp',
                        type: 'string',
                        example: '2025-05-06T16:34:49.937Z'
                      }),
                      updatedAt: z.string().openapi({
                        description: 'User update timestamp',
                        type: 'string',
                        example: '2025-05-06T16:34:49.937Z'
                      }),
                      isAdmin: z.boolean().openapi({
                        description: 'Flag indicating if the user has admin privileges',
                        type: 'boolean',
                        example: false
                      }),
                      isOnTrial: z.boolean().openapi({
                        description: 'Flag indicating if the user has an active trial',
                        type: 'boolean',
                        example: false
                      }),
                      trialStartDate: z.string().nullable().openapi({
                        description: 'Trial start date',
                        type: 'string',
                        example: '2025-05-06T16:34:49.937Z'
                      }),
                      trialEndDate: z.string().nullable().openapi({
                        description: 'Trial end date',
                        type: 'string',
                        example: '2025-05-20T16:34:49.937Z'
                      })
                    })
                  })
                })
              }
            }
          }
        }
      }),
      (ctx: any) => {
        const user = ctx.get('user')
        if (!user) {
          return ctx.json({ error: 'Unauthorized' }, 401)
        }
        return ctx.json({ success: true, data: { user } })
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/v1/users/stripe/{priceId}',
        tags: ['User'],
        summary: 'Retrieve stripe checkout or portal session URL',
        description: 'Retrieve a URL to either manage subscription or upgrade plan.',
        operationId: 'getUserStripeSession',
        request: {
          params: z.object({
            priceId: z.string().openapi({
              title: 'Price ID',
              description: 'Stripe Price ID for the subscription upgrade',
              type: 'string',
              example: 'price_ABC123'
            })
          })
        },
        responses: {
          200: {
            description: 'Successful response with URL details',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean().openapi({
                    description: 'Indicates whether the request was successful',
                    type: 'boolean',
                    example: true
                  }),
                  data: z.object({
                    url: z.string().openapi({
                      description: 'URL for the Stripe checkout or portal session',
                      type: 'string',
                      example: 'https://checkout.stripe.com/session/ABC123'
                    })
                  })
                })
              }
            }
          }
        }
      }),
      async (ctx: any) => {
        const stripe = ctx.get('stripe') as Stripe
        const billingUrl = absoluteUrl('/dashboard/billing')
        const user = ctx.get('user') as any
        if (!user) {
          return ctx.json({ error: 'Unauthorized' }, 401)
        }

        const { priceId } = ctx.req.valid('param')
        if (!priceId) {
          return ctx.json({ error: 'priceId parameter is required' }, 400)
        }

        try {
          const userId = user.id
          const getUserSubscriptionByUserUseCase = new GetUserSubscriptionByUserUseCase()
          const subscriptionPlan = await getUserSubscriptionByUserUseCase.run({ userId, currentUserId: userId })
          if (subscriptionPlan.isPro && subscriptionPlan.stripeCustomerId) {
            const stripeSession = await stripe.billingPortal.sessions.create({
              customer: subscriptionPlan.stripeCustomerId,
              return_url: billingUrl
            })
            return ctx.json({ success: true, data: { url: stripeSession.url } })
          }
          const sessionParams: Stripe.Checkout.SessionCreateParams = {
            success_url: billingUrl,
            cancel_url: billingUrl,
            payment_method_types: ['card'],
            mode: 'subscription',
            billing_address_collection: 'auto',
            subscription_data: {
              trial_period_days: 14
            },
            line_items: [
              {
                price: priceId,
                quantity: 1
              }
            ],
            metadata: {
              userId: user.id
            }
          }
          if (subscriptionPlan.stripeCustomerId) {
            sessionParams.customer = subscriptionPlan.stripeCustomerId
          } else {
            sessionParams.customer_email = user.email
          }
          const stripeSession = await stripe.checkout.sessions.create(sessionParams)
          return ctx.json({ success: true, data: { url: stripeSession.url } })
        } catch (error) {
          console.error(error)
          return ctx.json({ error: 'Internal Server Error' }, 500)
        }
      }
    )
    this.controller.openapi(
      createRoute({
        method: 'get',
        path: '/stripe/open-portal/{userStripeId}',
        tags: ['User'],
        summary: 'Access Stripe Billing Portal',
        description: 'Access the Stripe Billing Portal to manage your subscription.',
        operationId: 'getUserStripePortal',
        request: {
          params: z.object({
            userStripeId: z.string().openapi({
              title: 'User Stripe ID',
              description: 'Stripe Customer ID',
              type: 'string',
              example: 'cus_ABC123'
            })
          })
        },
        responses: {
          200: {
            description: 'Successful response with Stripe Billing Portal URL',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean().openapi({
                    description: 'Indicates whether the request was successful',
                    type: 'boolean',
                    example: true
                  }),
                  data: z.object({
                    url: z.string().openapi({
                      description: 'URL for the Stripe Billing Portal',
                      type: 'string',
                      example: 'https://billing.stripe.com/session/ABC123'
                    })
                  })
                })
              }
            },
            400: {
              description: 'Bad request - Missing userStripeId',
              content: {
                'application/json': {
                  schema: z.object({
                    error: z.string()
                  })
                }
              }
            },
            500: {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: z.object({
                    error: z.string()
                  })
                }
              }
            }
          }
        }
      }),
      async (ctx: any) => {
        const stripe = ctx.get('stripe') as Stripe
        const billingUrl = absoluteUrl('/dashboard/billing')

        const { userStripeId } = ctx.req.valid('param')

        if (!userStripeId) {
          return ctx.json({ error: 'userStripeId parameter is required' }, 400)
        }

        try {
          const stripeSession = await stripe.billingPortal.sessions.create({
            customer: userStripeId,
            return_url: billingUrl
          })

          return ctx.json({ success: true, data: { url: stripeSession.url } })
        } catch (error: any) {
          console.error('Stripe portal error:', error)

          if (error.type === 'StripeInvalidRequestError') {
            return ctx.json(
              {
                error: 'Invalid request to Stripe API',
                details: error.message
              },
              400
            )
          }

          return ctx.json({ error: 'Internal Server Error' }, 500)
        }
      }
    )
  }
}
