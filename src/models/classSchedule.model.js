import mongoose from "mongoose";

const classScheduleSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  className: { type: String, required: true },
  classBatch: { type: String, required: true ,trim :true},
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  locationLat: Number,
  locationLon: Number,
  isActive: { type: Boolean, default: false },
},{timestamps:true});

export const ClassSchedule = mongoose.model("ClassSchedule", classScheduleSchema);
