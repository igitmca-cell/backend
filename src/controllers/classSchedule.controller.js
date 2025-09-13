import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ClassSchedule } from "../models/classSchedule.model.js";
import { sendPushNotifications } from "../utils/notificationService.js";
import { User } from "../models/user.model.js";
// ✅ Create new class schedule
export const createClassSchedule = asyncHandler(async (req, res) => {
    const { className, startTime, endTime,classBatch } = req.body;
    const teacherId = req.user._id; // Provided by auth middleware
   
    
  
    if (!className || !startTime || !endTime || !classBatch) {
      throw new ApiError(400, "Class name, start time,  end time and Class Batch are required");
    }
  
  const parsedStart = new Date(startTime);
const parsedEnd = new Date(endTime);





  
    if (isNaN(parsedEnd) || isNaN(parsedStart)) { 
      throw new ApiError(400, "Invalid date format for startTime or endTime");
    }
  
    const newSchedule = await ClassSchedule.create({
      teacherId,
      className,
      classBatch,
      startTime: parsedStart,
      endTime: parsedEnd,
      isActive: true, // optional: if you want to set it active on creation
    });
  
    // Push notification (optional async)
    sendPushNotifications(
      "Class Schedule",
      `Your class "${className}" is scheduled from ${parsedStart.toLocaleString()} to ${parsedEnd.toLocaleString()}`
    );
  
    res.status(201).json(
      new ApiResponse(201, newSchedule, "Class schedule created successfully")
    );
  });

// ✅ Update class schedule
export const updateClassSchedule = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const teacherId = req.user._id;

  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  const updates = req.body;
  Object.assign(schedule, updates);

  const updatedSchedule = await schedule.save();

  sendPushNotifications("Class schedule updated !!",`Your class Schedule for ${updatedSchedule.className} from ${updatedSchedule.startTime} to ${updatedSchedule.endTime} `)
  res
    .status(200)
    .json(new ApiResponse(200, schedule, "Class schedule updated successfully"));
});

// ✅ Delete class schedule
export const deleteClassSchedule = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const teacherId = req.user._id;

  const schedule = await ClassSchedule.findOneAndDelete({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  res
    .status(200)
    .json(new ApiResponse(200, schedule, "Class schedule deleted successfully"));
});

// ✅ Get all schedules for teacher
export const getAllClassSchedules = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const schedules = await ClassSchedule.find({ teacherId }).sort({ startTime: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, schedules, "All class schedules retrieved"));
});
export const getAllClassSchedulesForStudent = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const studentDetails = await User.findById(studentId);

  const studentBatch = studentDetails.batch ;

  const schedules = await ClassSchedule.find({"classBatch": studentBatch }).sort({ startTime: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, schedules, "All class schedules retrieved"));
});

// ✅ Get single class schedule
export const getSingleClassSchedule = asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const teacherId = req.user._id;

  const schedule = await ClassSchedule.findOne({ _id: scheduleId, teacherId });
  if (!schedule) throw new ApiError(404, "Schedule not found");

  res
    .status(200)
    .json(new ApiResponse(200, schedule, "Class schedule details retrieved"));
});
