import { Router } from "express";
import {
  startClass,
  endClass,
  markAttendance,
  getStudentAttendance,
  getClassAttendance,
} from "../controllers/attendance.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js"; // For photo upload if needed

const router = Router();

// Start a class (teacher only)
router.route("/start").post(verifyJWT, startClass);

// End a class (teacher only)
router.route("/end").post(verifyJWT, endClass);

// Mark attendance (student only)
router.route("/mark").post(verifyJWT, markAttendance);


// Get student's own attendance (student only)
router.route("/student").get(verifyJWT, getStudentAttendance);

// Get class attendance (teacher or CDC)
router.route("/class/:scheduleId").get(verifyJWT, getClassAttendance);

export default router;
