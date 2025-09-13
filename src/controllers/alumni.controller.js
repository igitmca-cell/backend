// alumni.controller.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Alumni } from "../models/alumni.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// Get all alumni
const getAllAlumni = asyncHandler(async (req, res) => {
  // Ensure user is authenticated (optional, remove if not needed)
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to access alumni data");
  }

  const alumni = await Alumni.find()
    .sort({ createdAt: -1 })
    .lean();

  if (!alumni.length) {
    throw new ApiError(404, "No alumni records found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {
      count: alumni.length,
      data: alumni
    }, "Alumni records fetched successfully"));
});

// Get single alumni by ID
const getAlumniById = asyncHandler(async (req, res) => {
  // Ensure user is authenticated (optional, remove if not needed)
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to access alumni data");
  }

  const alumni = await Alumni.findById(req.params.id).lean();

  if (!alumni) {
    throw new ApiError(404, "Alumni not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, alumni, "Alumni record fetched successfully"));
});





// Delete alumni
const deleteAlumni = asyncHandler(async (req, res) => {
  // Ensure user is authenticated (optional, remove if not needed)
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to delete alumni records");
  }

  const alumni = await Alumni.findByIdAndDelete(req.params.id);

  if (!alumni) {
    throw new ApiError(404, "Alumni not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Alumni record deleted successfully"));
});

// Insert new alumni (updated)
const createAlumni = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to create alumni records");
  }

  const { name, designation, batch, linkedinUrl, location } = req.body;
  console.log(location);
  

  if ([name, designation, batch, linkedinUrl, location?.latitude, location?.longitude].some(
    (field) => field === undefined || field === null || field.toString().trim() === ""
  )) {
    throw new ApiError(400, "All required fields (name, designation, batch, linkedinUrl, location) must be provided");
  }

  if (!/^\d{4}-\d{4}$/.test(batch)) {
    throw new ApiError(400, "Batch must be in format YYYY-YYYY (e.g., 2015-2018)");
  }

  // Handle file uploads
  let profileImageUrl, companyLogoUrl;
  
  if (req.files?.profileImage?.[0]?.path) {
    const profileImageUpload = await uploadOnCloudinary(req.files.profileImage[0].path);
    if (!profileImageUpload?.secure_url) {
      throw new ApiError(400, "Error uploading profile image to Cloudinary");
    }
    profileImageUrl = profileImageUpload.secure_url;
  }

  if (req.files?.companyLogo?.[0]?.path) {
    const companyLogoUpload = await uploadOnCloudinary(req.files.companyLogo[0].path);
    if (!companyLogoUpload?.secure_url) {
      throw new ApiError(400, "Error uploading company logo to Cloudinary");
    }
    companyLogoUrl = companyLogoUpload.secure_url;
  }

  const alumniData = {
    name,
    designation,
    batch,
    linkedinUrl,
    profileImage: profileImageUrl,
    companyLogo: companyLogoUrl,
    location: {
      latitude: parseFloat(location.latitude),
      longitude: parseFloat(location.longitude)
    }
  };

  const newAlumni = await Alumni.create(alumniData);

  if (!newAlumni) {
    throw new ApiError(500, "Something went wrong while creating the alumni record");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newAlumni, "Alumni record created successfully"));
});

// Update existing alumni (updated)
const updateAlumni = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to update alumni records");
  }

  const { name, designation, batch, linkedinUrl, location } = req.body;

  if (!name && !designation && !batch && !linkedinUrl && !location && !req.files?.profileImage && !req.files?.companyLogo) {
    throw new ApiError(400, "At least one field must be provided for update");
  }

  const updateData = {};
  if (name) updateData.name = name;
  if (designation) updateData.designation = designation;
  if (batch) {
    if (!/^\d{4}-\d{4}$/.test(batch)) {
      throw new ApiError(400, "Batch must be in format YYYY-YYYY (e.g., 2015-2018)");
    }
    updateData.batch = batch;
  }
  if (linkedinUrl) updateData.linkedinUrl = linkedinUrl;

  // Handle file uploads for update
  if (req.files?.profileImage?.[0]?.path) {
    const profileImageUpload = await uploadOnCloudinary(req.files.profileImage[0].path);
    if (!profileImageUpload?.secure_url) {
      throw new ApiError(400, "Error uploading profile image to Cloudinary");
    }
    updateData.profileImage = profileImageUpload.secure_url;
  }

  if (req.files?.companyLogo?.[0]?.path) {
    const companyLogoUpload = await uploadOnCloudinary(req.files.companyLogo[0].path);
    if (!companyLogoUpload?.secure_url) {
      throw new ApiError(400, "Error uploading company logo to Cloudinary");
    }
    updateData.companyLogo = companyLogoUpload.secure_url;
  }

  if (location) {
    if (location.latitude === undefined || location.longitude === undefined) {
      throw new ApiError(400, "Both latitude and longitude must be provided if updating location");
    }
    updateData.location = {
      latitude: parseFloat(location.latitude),
      longitude: parseFloat(location.longitude)
    };
  }

  const updatedAlumni = await Alumni.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedAlumni) {
    throw new ApiError(404, "Alumni not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedAlumni, "Alumni record updated successfully"));
});

export {
  getAllAlumni,
  getAlumniById,
  createAlumni,
  updateAlumni,
  deleteAlumni
};