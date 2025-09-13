import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Attendance } from "../models/attendance.model.js";
import { ClassSchedule } from "../models/classSchedule.model.js";
import { User } from "../models/user.model.js";
import { sendPushNotifications } from "../utils/notificationService.js";
import geolib from "geolib";
import axios from "axios";
import fs from 'fs';
import FormData from "form-data";
import mongoose from "mongoose";



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
  console.log(req.body);
  

  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  // if (schedule.isActive) throw new ApiError(400, "Class already started");

  // ✅ Update location if provided
  if (locationLat && locationLon) {
    schedule.locationLat = locationLat;
    schedule.locationLon = locationLon;
  }

  schedule.isActive = true;
  await schedule.save();
    sendPushNotifications(
      "Attendance",
      `Now You can mark attendance for ${schedule.className}`
    );

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


// ✅ Mark attendance (student) with base64 photo
export const markAttendance = asyncHandler(async (req, res) => {
  const { scheduleId, location, photo } = req.body;
  const studentId = req.user._id;

  if (!scheduleId || !location?.lat || !location?.lon || !photo) {
    throw new ApiError(400, "Schedule ID, location, and photo are required");
  }

  // ✅ Decode base64 → temp file
  const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  // Save in temp folder (make sure `public/temp/` exists)
  const tempFilePath = `public/temp/${Date.now()}_${studentId}.png`;
  fs.writeFileSync(tempFilePath, buffer);

  try {
    const schedule = await ClassSchedule.findById(scheduleId);
    const student = await User.findById(studentId);
    if (!schedule || !student) throw new ApiError(404, "Schedule or student not found");

    if (!schedule.isActive) throw new ApiError(400, "Class is not active");

    const isInRange = verifyLocation(
      { lat: schedule.locationLat, lon: schedule.locationLon },
      location
    );
    if (!isInRange) throw new ApiError(400, "You are not in the classroom location");

    // ✅ Prepare form-data for /match_faces
    const formData = new FormData();
    formData.append("file1", fs.createReadStream(tempFilePath)); // decoded photo file
    formData.append("file2", student.profileImage);              // student's stored profile image

    const response = await axios.post("http://3.6.19.254/match_faces", formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
    });

    const isVerified = response.data?.match === true;
    if (!isVerified) throw new ApiError(401, "Biometric verification failed");

    // ✅ Mark attendance
    const attendance = await Attendance.create({
      scheduleId,
      studentId,
      timestamp: new Date(),
      status: "present",
      verified: true,
    });

    res.status(200).json(
      new ApiResponse(
        200,
        { attendanceId: attendance._id },
        "Attendance marked successfully with biometric"
      )
    );
  } finally {
    // ✅ Always cleanup temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error("❌ Failed to delete temp photo:", err);
        else console.log("✅ Temp photo deleted:", tempFilePath);
      });
    }
  }
});


// ✅ Get student’s own attendance history
export const getStudentAttendance = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const records = await Attendance.find({ studentId }).populate("scheduleId");

  res.status(200).json(new ApiResponse(200, records, "Student attendance history"));
});

// ✅ Get all attendance records for a class (teacher)
export const getClassAttendance = asyncHandler(async (req, res) => {
  let { scheduleId } = req.params;
  const teacherId = req.user._id;
 
  
 if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      scheduleId = scheduleId.padEnd(24, "0"); // pad to 24 characters
      if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
        return res.status(400).json({ message: "Invalid schedule ID" });
      }
    }
   
  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  const records = await Attendance.find({ scheduleId }).populate("studentId");

  res.status(200).json(new ApiResponse(200, records, "Class attendance list"));
});
