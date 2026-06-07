import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { response } from "express";

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


export { registerUser }