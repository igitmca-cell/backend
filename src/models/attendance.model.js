import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassSchedule",
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    default: "present",
  },
  verifiedByPhoto: {
    type: Boolean,
    default: false,
  },
  photoPath: {
    type: String, // Local file system path to the saved photo
    required: false,
  },
},{timestamps:true});

export const Attendance = mongoose.model("Attendance", attendanceSchema);
