import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler.js";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";
export const verifyJWT = asyncHandler( async (req, res, next) =>
    {
     try {
           const token = req.cookies?.accessToken || req.header
           ("Authorization")?.replace("Bearer ", "")
   
           if(!token) {
               throw new ApiError(401, "Unauthorized request")
           }
   
           const decodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
   
           const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
           
   
           if(!user){
               // TODO: discuss about frontend
               throw new ApiError(401, "Invalid Access Token")
           }
   
           // if it is confirmed that user exists
           req.user = user;
   
           next()
     } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
     } 
})