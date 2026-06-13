import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { response } from "express";
import { trusted } from "mongoose";
import jwt from "jsonwebtoken";

const registerUser = asyncHandler( async (req, res) => {

    /*
    Step 1: get user details from frontend
    Step 2: Validation of data
    Step 3: Check if user already exists: username check
    Step 4: Check for images, check for avatar
    Step 5: If available upload on cloudinary, avatar
    Step 6: Create user object - create entry in db
    Step 7: Remove password and refresh token field from response
    Step 8: Check for user creation
    Step 9: Return response
    */
   
    // user details can be found in req.body (if in json)

    const {fullName, email, username, password} = req.body

    // can make many if else blocks, alternate method used
    /*if(fullName === ""){
        throw new ApiError(400, "fullname is required")
    } */

    if(
        [fullName, email, username, password].some( (field) =>
            !field || field.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(email)) {
    throw new ApiError(400, "Invalid email format")
    }

    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_]+$/

    if (!usernameRegex.test(username)) {
        throw new ApiError(
            400,
            "Username can only contain letters, numbers, and underscores"
        )
    }

    if (username.length < 3 || username.length > 20) {
        throw new ApiError(
            400,
            "Username must be between 3 and 20 characters"
        )
    }

    // Password validation
    if (password.length < 8) {
        throw new ApiError(
            400,
            "Password must be at least 8 characters"
        )
    }

    const existedUser = await User.findOne({
        $or: [
            { username: username.toLowerCase() },
            { email: email.toLowerCase() }
        ]
    })

    if(existedUser){
        
        if(existedUser.username === username) {
            throw new ApiError(409, "Username already taken")
        }

        if(existedUser.email === email) {
            throw new ApiError(409, "User with email already exists")
        }
    }



    // checking for images

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    // uploading to cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath 
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null


    if(!avatar) {
        throw new ApiError(400, "Avatar uplaod failed")
    }


    const user = await User.create({
        fullname: fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })


    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" 
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered succesfully")
    )






})


// method to generate access and Refresh token as itll be used again


/* Here we could also pass user directly which may be 
    better for the database as it'll decrease one query from server
    but there may be some edge cases where it might fail so for now we go with userId
*/
const generateAccessandRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken

        
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}
    }
    catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const loginUser = asyncHandler( async (req,res) => {
    // Step 1: Get data from body
    // Step 2: login using username or email
    // Step 3: Check if user exists
    // Step 4: If user exists check password
    // Step 5: Generate Access and Refresh Tokens for user
    // Step 6: Send tokens in cookies



    const {email, username, password} = req.body

    if(!(username || !email)){
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [
            {username},
            {email}
        ]
    })

    if(!user){
        throw new ApiError(400, "User Not Registered")
    }

    // checking for password

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Inavlid User Credentials")
    }

    const { accessToken, refreshToken  }= await generateAccessandRefreshTokens(user._id)

    // here instead of calling db again we can also do it manually to improve speed

    // though doing manually may not reflect changes in Database which works for login 

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    
    // setting up options for cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    // using these options above cookies can be modified through server only

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            }, 
            "User Logged In Succesfully"
        )
    )
})

const logoutUser = asyncHandler( async(req,res)=>{
    // When Logging out
    // Clearing the cookies for user, removing Refresh Token also
    

    // since we are using auth middleware before logoutUser in routes
    // we have access to user here

    await User.findByIdAndUpdate(
        req.user._id,
        {
            // set operator is a mongoDB
            // it gives an object as to what all to update
            
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    // setting up options for cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    // we need to clear cookies 

    return res.status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200,{}, "User Logged Out Succesfully"))

})

// endpoint for refresh access token 
// (used for creating an endpoint for frontend which frontend can use to refrehs accesstokens)


const refreshAccessToken = asyncHandler(async (req, res) =>
    {
        // Step1: Take refresh Tokens from either cookies or req body
        
        const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
        
        // handle if refresh token found or not

        if(!incomingRefreshToken){
            throw new ApiError(401, "Unauthorized Request")
        }

        // now verifying incoming token

        try {
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET
            )
            
    
            // Finding refresh token stored in database
            // Since while creating refresh token we had sent an _id with it so we can find the token such
    
            const user = await User.findById(decodedToken?._id)
    
    
            if(!user){
                throw new ApiError(401, "Invalid refresh token")
            }
    
            if(incomingRefreshToken !== user?.refreshToken){
                throw new ApiError(401, "Refresh Token is expired or used")
            }
    
    
            const options = {
                httpOnly: true,
                secure: true
            }
    
            const {accessToken, refreshToken: newRefreshToken} = await generateAccessandRefreshTokens(user._id)
    
    
            return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken: newRefreshToken},
                    "Access Token Refreshed Succesfully"
                )
            )
        } catch (error) {
            throw new ApiError(401, error?.message || "Invalid Refresh Token")
        }

})


const changeCurrentPassword = asyncHandler(async(req,res)=> {
    const {oldPassword, newPassword, confirmPassword} = req.body

    // validations start

    if([oldPassword,newPassword,confirmPassword].some(
        (field) => field?.trim() === ""
    )) {
        throw new ApiError(400, "All fields are required")
    }

    if(newPassword!== confirmPassword){
        throw new ApiError(400, "New Password and confirm password don't match")
    }


    if(oldPassword === newPassword){
        throw new ApiError(400, "New Password cannot be same as old password")
    }
    
    if (newPassword.length < 8) {
        throw new ApiError(
            400,
            "Password must be at least 8 characters"
        )
    }


    // validations end



    
    const user = await User.findById(req.user?._id)
    
    if(!user){
        throw new ApiError(401, "User not found")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid Old Password")
    }

    

    user.password = newPassword

    await user.save({validateBeforeSave:false})


    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Succesfully"))
})


const getCurrentUser = asyncHandler(async (req,res) =>{
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User Fetched Successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname, email} = req.body

    if (!fullname && !email) {
        throw new ApiError(
            400,
            "At least one field is required"
        )
    }

    const updateFields = {}

    if(fullname?.trim()){
        updateFields.fullname = fullname
    }

    if(email?.trim()){
        updateFields.email = email
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: updateFields
        },
        {
            new: true,
            runValidators: true
        }
    ).select("-password -refreshToken")


    return res
    .status(200)
    .json(new ApiResponse(200,user, "Account Details updated successfully"))

})


// for updating files and photos we will need to use two middlewares
// Multer middleware for files
// auth middleware for user validation

const updateUserAvatar = asyncHandler(async(req,res)=>
    {
        const avatarLocalPath = req.file?.path

        if(!avatarLocalPath){
            throw new ApiError(400, "Avatar File is Missing")
        }

        // get current user

        const currentUser = await User.findById(req.user?._id)

        const oldAvatarUrl = currentUser.avatar


        const avatar = await uploadOnCloudinary(avatarLocalPath)

        if(!avatar?.url){
            throw new ApiError(500, "Error while uploading on Avatar")
        }


        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            {
                new: true
            }
        ).select("-password -refreshToken")

        if(oldAvatarUrl){
            deleteFromCloudinary(oldAvatarUrl)
        }
        return res.status(200)
        .json(new ApiResponse(200, user,"Avatar Updated Succesfully"))
})


const updateUserCoverImage = asyncHandler(async(req,res)=>
    {
        const coverImageLocalPath = req.file?.path

        if(!coverImageLocalPath){
            throw new ApiError(400, "Cover Image File is Missing")
        }

        // get current user

        const currentUser = await User.findById(req.user?._id)

        const oldCoverImageUrl = currentUser?.coverImage

        
        const coverImage= await uploadOnCloudinary(coverImageLocalPath)

        if(!coverImage?.url){
            throw new ApiError(500, "Error while uploading Cover Image")
        }


        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            {
                new: true
            }
        ).select("-password -refreshToken")

        if(oldCoverImageUrl && oldCoverImageUrl.trim() !== ""){
            deleteFromCloudinary(oldCoverImageUrl)
        }
        return res.status(200)
        .json(new ApiResponse(200, user,"Cover Image Updated Succesfully"))
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"                
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers" // Added $ here
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: { // Fixed typo: $con -> $cond
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: { // Fixed typo: project -> $project
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
})




export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile
 }