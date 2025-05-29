import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { deleteFile, uploadFile } from '../config/upload.config'
import type { Buffer } from 'node:buffer'

export class UploadController {
  public controller: OpenAPIHono

  constructor() {
    this.controller = new OpenAPIHono()
    this.initRoutes()
  }

  public initRoutes() {
    this.controller.openapi(
      createRoute({
        method: 'post',
        path: '/v1/upload',
        security: [{ Bearer: [] }],
        summary: 'Upload a file',
        description: 'Upload a file to the cloud storage',
        request: {
          body: {
            content: {
              'multipart/form-data': {
                schema: z.object({
                  file: z.any(),
                  folder: z.string().optional().default('general')
                })
              }
            }
          }
        },
        responses: {
          200: {
            description: 'File uploaded successfully',
            content: {
              'application/json': {
                schema: z.object({
                  success: z.boolean(),
                  data: z.object({
                    url: z.string(),
                    public_id: z.string(),
                    resource_type: z.string()
                  })
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
        try {
          const user = c.get('user')
          if (!user) {
            return c.json({ success: false, error: 'Unauthorized' }, 401)
          }

          const formData = await c.req.formData()
          const file = formData.get('file') as File
          const folder = (formData.get('folder') as string) || 'general'

          if (!file) {
            return c.json({ success: false, error: 'No file provided' }, 400)
          }

          const buffer = Buffer.from(await file.arrayBuffer())
          const result = await uploadFile(buffer, folder)

          return c.json({
            success: true,
            data: result
          })
        } catch (error) {
          console.error('Upload error:', error)
          return c.json(
            {
              success: false,
              error: 'Failed to upload file'
            },
            400
          )
        }
      }
    )

    this.controller.openapi(
      createRoute({
        method: 'delete',
        path: '/v1/upload/{publicId}',
        security: [{ Bearer: [] }],
        summary: 'Delete a file',
        description: 'Delete a file from the cloud storage',
        request: {
          params: z.object({
            publicId: z.string()
          })
        },
        responses: {
          200: {
            description: 'File deleted successfully',
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
        try {
          const user = c.get('user')
          if (!user) {
            return c.json({ success: false, error: 'Unauthorized' }, 401)
          }

          const { publicId } = c.req.param()
          await deleteFile(publicId)

          return c.json({
            success: true
          })
        } catch (error) {
          console.error('Delete error:', error)
          return c.json(
            {
              success: false,
              error: 'Failed to delete file'
            },
            400
          )
        }
      }
    )
  }
}
