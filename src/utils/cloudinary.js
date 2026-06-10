import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"
import { ApiError } from "./ApiError.js" 
import {extractPublicId} from "cloudinary-build-url"
    // Configuration


    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
    });

const uploadOnCloudinary = async (localFilePath) => {
    try{
        if (!localFilePath){
            throw new ApiError(400, "File path is missing")
        }

        //  upload the file on cloudinary

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })

        // file has been uploaded succesfully
        console.log("File is uploaded on Cloudinary ",
            response.url);

        return response

    } catch (error) {

         console.log("Deleting file:", localFilePath)

    console.log("File deleted") 
        // removes the locally saved temp file as the upload operation failed
        throw new ApiError(
            500,
            error.message || "Failed to upload file on Cloudinary"
        )
    } finally {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            console.log("Local file cleaned up");
        }
    }
}



// delete file from cloudinary
const deleteFromCloudinary = async (url) => {

    try {

        if (!url) return null

        const publicId = extractPublicId(url)

        return await cloudinary.uploader.destroy(publicId, { resource_type: "image" });

    } catch (error) {

        console.log(
            "Cloudinary delete error:",
            error.message
        )

        return null
    }
}


export {uploadOnCloudinary, deleteFromCloudinary}