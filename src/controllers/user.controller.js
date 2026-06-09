import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { response } from "express";
import { trusted } from "mongoose";

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

    if(!username || !email){
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

    User.findByIdAndUpdate(
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





export { 
    registerUser,
    loginUser,
    logoutUser
 }