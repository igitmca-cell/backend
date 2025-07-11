import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Attendance } from "../models/attendance.model.js";
import { ClassSchedule } from "../models/classSchedule.model.js";
import { User } from "../models/user.model.js";
import geolib from "geolib";


// ✅ Utility: Verify location within a distance range
const verifyLocation = (classLocation, studentLocation, maxDistanceMeters = 100) => {
  try {
    const distance = geolib.getDistance(
      { latitude: classLocation.lat, longitude: classLocation.lon },
      { latitude: studentLocation.lat, longitude: studentLocation.lon }
    );
    return distance <= maxDistanceMeters;
  } catch {
    throw new ApiError(400, "Invalid location data");
  }
};



// ✅ Start class (teacher)
export const startClass = asyncHandler(async (req, res) => {
  const { scheduleId, locationLat, locationLon } = req.body;
  const teacherId = req.user._id;

  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  if (schedule.isActive) throw new ApiError(400, "Class already started");

  // ✅ Update location if provided
  if (locationLat && locationLon) {
    schedule.locationLat = locationLat;
    schedule.locationLon = locationLon;
  }

  schedule.isActive = true;
  await schedule.save();

  res.status(200).json(new ApiResponse(200, schedule, "Class started and location updated"));
});


// ✅ End class (teacher)
export const endClass = asyncHandler(async (req, res) => {
  const { scheduleId } = req.body;
  const teacherId = req.user._id;

  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  if (!schedule.isActive) throw new ApiError(400, "Class not active");

  schedule.isActive = false;
  await schedule.save();

  res.status(200).json(new ApiResponse(200, schedule, "Class ended"));
});

// ✅ Mark attendance (student) 
export const markAttendance = asyncHandler(async (req, res) => {
  const { scheduleId, location, payload, signature } = req.body;
  const studentId = req.user._id;

  if (!scheduleId || !location?.lat || !location?.lon || !payload || !signature) {
    throw new ApiError(400, "Schedule ID, location, payload, and signature are required");
  }

  const schedule = await ClassSchedule.findById(scheduleId);
  const student = await User.findById(studentId);
  if (!schedule || !student) throw new ApiError(404, "Schedule or student not found");

  if (!schedule.isActive) throw new ApiError(400, "Class is not active");

  const isInRange = verifyLocation(
    { lat: schedule.locationLat, lon: schedule.locationLon },
    location
  );
  if (!isInRange) throw new ApiError(400, "You are not in the classroom location");

  // ✅ Biometric signature verification
  const NodeRSA = require("node-rsa");

  const publicKey = student.biometricPublicKey; // Must be stored during setup
  if (!publicKey) throw new ApiError(400, "Biometric public key not set up for this user");

  const key = new NodeRSA();
  key.importKey(publicKey, "pkcs8-public");

  const isVerified = key.verify(
    Buffer.from(payload),
    Buffer.from(signature, "base64")
  );

  if (!isVerified) throw new ApiError(401, "Biometric verification failed");

  // ✅ If all good, mark attendance
  const attendance = await Attendance.create({
    scheduleId,
    studentId,
    timestamp: new Date(),
    status: "present",
    verified: true, 
  });

  res.status(200).json(
    new ApiResponse(200, { attendanceId: attendance._id }, "Attendance marked successfully with biometric")
  );
});


// ✅ Get student’s own attendance history
export const getStudentAttendance = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const records = await Attendance.find({ studentId }).populate("scheduleId");

  res.status(200).json(new ApiResponse(200, records, "Student attendance history"));
});

// ✅ Get all attendance records for a class (teacher)
export const getClassAttendance = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const teacherId = req.user._id;

  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  const records = await Attendance.find({ scheduleId }).populate("studentId");

  res.status(200).json(new ApiResponse(200, records, "Class attendance list"));
});
