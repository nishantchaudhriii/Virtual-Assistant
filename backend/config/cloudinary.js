import { v2 as cloudinary } from "cloudinary"
import fs from "fs"

const isConfigured = () =>
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET

// Returns the Cloudinary URL, or null when Cloudinary is not configured / fails.
// (The caller then falls back to serving the file from the local /public folder.)
const uploadOnCloudinary = async (filePath) => {
    if (!isConfigured()) return null

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    })

    try {
        const uploadResult = await cloudinary.uploader.upload(filePath)
        fs.unlinkSync(filePath)
        return uploadResult.secure_url
    } catch (error) {
        console.error("Cloudinary upload failed, using local file instead:", error.message)
        return null
    }
}

export default uploadOnCloudinary
