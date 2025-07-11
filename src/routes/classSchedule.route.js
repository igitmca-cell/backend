import { Router } from "express";
import {
  createClassSchedule,
  updateClassSchedule,
  deleteClassSchedule,
  getAllClassSchedules,
  getSingleClassSchedule,
  getAllClassSchedulesForStudent
 
} from "../controllers/classSchedule.controller.js";
import { startClass,endClass } from "../controllers/attendance.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/active").get(verifyJWT, getAllClassSchedulesForStudent);
// Public route - Get all schedules of logged-in teacher
router.route("/").get(verifyJWT, getAllClassSchedules);

// Restricted routes (for teachers)
router.route("/create").post(verifyJWT, createClassSchedule);
router.route("/edit/:scheduleId").put(verifyJWT, updateClassSchedule);
router.route("/delete/:scheduleId").delete(verifyJWT, deleteClassSchedule);
router.route("/:scheduleId").get(verifyJWT, getSingleClassSchedule);

// Class control (start/end)
router.route("/start").post(verifyJWT, startClass);
router.route("/end").post(verifyJWT, endClass);

export default router;
