import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/notificationService.js";
import { log } from "console";
/**
 * Registers an Expo push token for the authenticated user.
 */
const registerToken = asyncHandler(async (req, res) => {
  // Extract expoPushToken from request body
  const { expoPushToken } = req.body;

  // Validate input
  if (!expoPushToken) {
    throw new ApiError(400, "Expo push token is required");
  }

  // Ensure user is authenticated (req.user should be set by middleware)
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User must be authenticated to register a token");
  }

  // Find the user by ID
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update the user's expoPushToken
  user.expoPushToken = expoPushToken;
  await user.save();

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Push token registered successfully"));
});
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, password, linkedinUrl, githubUrl, rollno } = req.body;

  if ([fullname, email, password].some((field) => !field?.trim())) {
    throw new ApiError(400, "Fullname, email, and password are required");
  }

  const existedUser = await User.findOne({ email });
  if (existedUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  let avatar;
  const avatarLocalPath = req.files?.profileImage[0]?.path;
  console.log(avatarLocalPath);
  
  if (avatarLocalPath) {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar?.url) {
      throw new ApiError(400, "Error uploading avatar");
    }
  }
   const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 0-based, so +1

  // Assume batch 43 starts Aug 2024
  const baseBatch = 43;
  const baseYear = 2024;

  // If month >= 8 (Aug or later), batch year starts this year; else previous year
  const batchOffset = month >= 8 ? year - baseYear : year - baseYear - 1;
  const batch = baseBatch + batchOffset;

  const user = await User.create({
    fullname,
    email,
    password,
    linkedinUrl,
    githubUrl,
    rollno,
    'profileImage': avatar.secure_url,
    status: "pending",
    batch
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }

  const mailData = {
    name: createdUser.fullname,
    loginLink: "https://cspcb.netlify.app",
    year: 2025,
    companyLogo: "https://upload.wikimedia.org/wikipedia/en/5/5c/Indira_Gandhi_Institute_of_Technology%2C_Sarang_Logo.png",
  };
  await sendEmail(createdUser.email, "Account creation", "account-creation", mailData);

  return res.status(201).json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password incorrect");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true });

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user || incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);
    const options = { httpOnly: true, secure: true };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed"));
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email, linkedinUrl, githubUrl, rollno } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "Fullname and email are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullname, email, linkedinUrl, githubUrl, rollno } },
    { new: true }
  ).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { profileImage: avatar.url } },
    { new: true }
  ).select("-password -refreshToken");

  return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});


const getAllBatchmates = asyncHandler(async (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to access batchmates");
  }

  const userBatch = req.user.batch; // Get the batch of the authenticated user

  // Fetch all users from the same batch, excluding the current user
  const batchmates = await User.find({ 
    batch: userBatch,
    _id: { $ne: req.user._id } // Exclude the current user
  })
    .select("fullname rollno profileImage linkedinUrl githubUrl") // Select required fields
    .lean(); // Convert to plain JS objects

  if (!batchmates || batchmates.length === 0) {
    throw new ApiError(404, "No batchmates found for your batch");
  }

  // Map the batchmates to the desired format
  const formattedBatchmates = batchmates.map((user) => ({
    name: user.fullname,
    rollno: user.rollno,
    profileImage: user.profileImage || null,
    domain: "software developer", // Default since domain isn't in schema
    linkedinUrl: user.linkedinUrl || null,
    githubUrl: user.githubUrl || null,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, formattedBatchmates, `Batchmates from batch ${userBatch} fetched successfully`));
});
const getAllCrCdcByBatch = asyncHandler(async (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to access CR/CDC data");
  }

  const { userBatch }= req.body; 

  // Fetch all users from the same batch who are either CR or CDC
  const crCdcMembers = await User.find({
    batch: userBatch,
    role: { $in: ["cr", "cdc","mycomp"] }, // Filter for users with role CR or CDC
  })
    .select("fullname role profileImage linkedinUrl githubUrl") // Select only required fields
    .lean(); // Convert to plain JS objects

  if (!crCdcMembers || crCdcMembers.length === 0) {
    throw new ApiError(404, `No CR or CDC members found for batch ${userBatch}`);
  }

  // Map the CR/CDC members to the desired format
  const formattedCrCdc = crCdcMembers.map((member) => ({
    name: member.fullname,
    role: member.role, // CR or CDC
    profileImage: member.profileImage || null,
    linkedinUrl: member.linkedinUrl || null,
    githubUrl: member.githubUrl || null,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, formattedCrCdc, `CR and CDC members from batch ${userBatch} fetched successfully`));
});
const makeCrCdc = asyncHandler(async (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to assign CR/CDC roles");
  }

  const { userId, role } = req.body; // Expect userId and role (cr/cdc) in request body


  // Validate request body
  if (!userId || !role) {
    throw new ApiError(400, "User ID and role (cr/cdc) are required");
  }
  if (!["cr", "cdc","mycomp"].includes(role)) {
    throw new ApiError(400, "Role must be either 'cr' or 'cdc'");
  }

  // Check if the authenticated user is a CDC
  const currentUser = req.user;
  if (currentUser.role !== "cdc") {
    throw new ApiError(403, "Forbidden: Only CDC members can assign CR/CDC/MYCOMP roles");
  }

  // Parse batches as numbers (assuming batch is a string like "43")
  const previousBatch = parseInt(currentUser.batch, 10); // e.g., 43
  const currentBatch = (previousBatch + 1).toString(); // e.g., "44"

  // Fetch the target user to assign the role
  const targetUser = await User.findById(userId).select("batch role status");
  if (!targetUser) {
    throw new ApiError(404, "Target user not found");
  }

  // Ensure the target user is from the current batch (next batch after CDC's batch)
  if (targetUser.batch !== currentBatch) {
    throw new ApiError(403, `Forbidden: Can only assign roles to users in batch ${currentBatch}`);
  }

  // Prevent assigning role to inactive users
  if (targetUser.status === "inactive") {
    throw new ApiError(400, "Cannot assign role to an inactive user");
  }

  // Prevent overwriting an existing CR/CDC role (optional)
  if (["cr", "cdc","mycomp"].includes(targetUser.role)) {
    throw new ApiError(400, `User is already assigned as ${targetUser.role}`);
  }

  // Update the target user's role
  targetUser.role = role;
  await targetUser.save();

  // Fetch updated user details for response
  const updatedUser = await User.findById(userId)
    .select("fullname role profileImage linkedinUrl githubUrl")
    .lean();

  const formattedUser = {
    name: updatedUser.fullname,
    role: updatedUser.role,
    profileImage: updatedUser.profileImage || null,
    linkedinUrl: updatedUser.linkedinUrl || null,
    githubUrl: updatedUser.githubUrl || null,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, formattedUser, `User assigned as ${role} for batch ${currentBatch} successfully`));
});

const approveStudent = asyncHandler(async (req,res)=>{
 if(!req.user){
   throw new ApiError(401, "Unauthorized: Please log in to assign CR/CDC roles");
 }
 const {studentId} = req.body 
 if(!studentId){
  throw new ApiError(404,"studentId can not be blank");
 }
 const student = await User.findById(studentId);
 if(!student){
  throw new ApiError(404,"Target User not found")
 }
 if(student.status == 'active'){
  throw new ApiError(404,"Student already activate");
 }
 student.status = 'active'
 await student.save();
return res
    .status(200)
    .json(new ApiResponse(200, `${studentId} is activated  successfully`));


});
const pendingStudent = asyncHandler(async (req,res)=>{
 if(!req.user){
   throw new ApiError(401, "Unauthorized: Please log in to assign CR/CDC roles");
 }

 const students = await User.find({status:'pending'});
 if(!students){
  throw new ApiError(404,"Target User not found")
 }


return res
    .status(200)
    .json(new ApiResponse(200, students,`pending students found successfully`));


});

const setSignature = asyncHandler(async (req,res)=>{
  if(!req.user){
    throw new ApiError(401,"Unauthorized access")
  }
  const {signature} = req.body;
  if(!signature){
    throw new ApiError(404,"Student signature can not be blank");
  } 
  const targetUser = await User.findById(req.user._id);

  if(!targetUser){
    throw new ApiError(404,"Target user not found")
  }
  if(targetUser.biometricPublicKey){
    throw new ApiError(404,"Signature already store further can't store again")
  }

  targetUser.biometricPublicKey = signature;
  await targetUser.save();

  return res.status(200).json(new ApiResponse(200,`Signature or biomatrickey store for the ${req.user._id} successfully`));


});



export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  getAllBatchmates,
  registerToken,
  getAllCrCdcByBatch,
  makeCrCdc,
  approveStudent,
  setSignature,
  pendingStudent
};

