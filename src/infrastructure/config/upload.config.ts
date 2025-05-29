import { env } from 'node:process'
import { v2 as cloudinary } from 'cloudinary'
import type { Buffer } from 'node:buffer'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
})

export interface UploadResponse {
  url: string
  public_id: string
  resource_type: string
}

export const uploadFile = async (file: Buffer, folder: string): Promise<UploadResponse> => {
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) {
              reject(error)
            } else {
              resolve(result)
            }
          }
        )
        .end(file)
    })

    return result as UploadResponse
  } catch (error) {
    console.error('Upload error:', error)
    throw new Error('Failed to upload file')
  }
}

export const deleteFile = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Delete error:', error)
    throw new Error('Failed to delete file')
  }
}
