import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SemesterResource } from "../models/semesterResource.model.js";

const addSemesterResource = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to upload resources");
  }

  const { semester, subject, type, title, description, batch, academicYear } = req.body;

  // Validate required fields
  if ([semester, subject, type, title].some((field) => !field?.toString().trim())) {
    throw new ApiError(400, "Semester, subject, type, and title are required");
  }

  // Validate type
  if (!["notes", "questionPaper"].includes(type)) {
    throw new ApiError(400, "Type must be either 'notes' or 'questionPaper'");
  }

  // Validate semester
  if (![1, 2, 3, 4].includes(parseInt(semester, 10))) {
    throw new ApiError(400, "Semester must be 1, 2, 3, or 4");
  }

  // For question papers, batch is required
  if (type === "questionPaper" && !batch?.trim()) {
    throw new ApiError(400, "Batch is required for question papers");
  }

  // Handle file upload
  let fileUrl;
//   req.files?.profileImage[0]?.path;
  const fileLocalPath = req.files?.file[0]?.path; // Assuming multer middleware with field name 'file'
  if (!fileLocalPath) {
    throw new ApiError(400, "File upload is required");
  }

  const uploadedFile = await uploadOnCloudinary(fileLocalPath);
  if (!uploadedFile?.url) {
    throw new ApiError(400, "Error uploading file to Cloudinary");
  }
  console.log(uploadedFile);
  
  fileUrl = uploadedFile.secure_url;

  // Prepare resource data
  const resourceData = {
    semester: parseInt(semester, 10),
    subject,
    type,
    fileUrl,
    uploadedBy: req.user._id,
    title,
    description,
  };

  // Add batch and academicYear only for question papers
  if (type === "questionPaper") {
    resourceData.batch = batch;
    resourceData.academicYear = academicYear || undefined;
  }

  // Create the resource
  const resource = await SemesterResource.create(resourceData);

  // Fetch created resource without sensitive fields (if any)
  const createdResource = await SemesterResource.findById(resource._id)
    .populate("uploadedBy", "fullname") // Optionally include uploader's name
    .lean();

  if (!createdResource) {
    throw new ApiError(500, "Something went wrong while adding the resource");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdResource, `${type === "notes" ? "Notes" : "Question paper"} added successfully`));
});



const getSemesterResources = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.user) {
    throw new ApiError(401, "Unauthorized: Please log in to access resources");
  }

  const { semester } = req.query; // Expect semester as a query parameter
  // const userBatch = req.user.batch; // Get user's batch from authenticated user

  // Validate semester
  if (!semester || ![1, 2, 3, 4].includes(parseInt(semester, 10))) {
    throw new ApiError(400, "Valid semester (1, 2, 3, or 4) is required");
  }

  // Fetch notes (batch-agnostic) and question papers (batch-specific) in parallel
  const [notes, questionPapers] = await Promise.all([
    SemesterResource.find({
      semester: parseInt(semester, 10),
      type: "notes",
    })
      .select("semester subject fileUrl title description uploadedBy createdAt")
      .populate("uploadedBy", "fullname")
      .lean(),
    SemesterResource.find({
      semester: parseInt(semester, 10),
      type: "questionPaper"
    })
      .select("semester subject fileUrl title description academicYear uploadedBy createdAt")
      .populate("uploadedBy", "fullname")
      .lean(),
  ]);

  // Format the resources
  const formattedNotes = notes.map((note) => ({
    semester: note.semester,
    subject: note.subject,
    fileUrl: note.fileUrl,
    title: note.title,
    description: note.description || null,
    uploadedBy: note.uploadedBy || null,
    createdAt: note.createdAt,
  }));

  const formattedQuestionPapers = questionPapers.map((qp) => ({
    semester: qp.semester,
    subject: qp.subject,
    fileUrl: qp.fileUrl,
    title: qp.title,
    description: qp.description || null,
    academicYear: qp.academicYear || null,
    uploadedBy: qp.uploadedBy ||null,
    createdAt: qp.createdAt,
  }));

  // Combine into a single response object
  const resources = {
    notes: formattedNotes,
    questionPapers: formattedQuestionPapers,
  };

  // Check if there are any resources; if not, throw an error
  if (resources.notes.length === 0 && resources.questionPapers.length === 0) {
    throw new ApiError(404, `No resources found for semester ${semester} `);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, resources, `Resources for semester ${semester}  fetched successfully`));
});
export{
    addSemesterResource,
    getSemesterResources
}