// alumni.route.js
import { Router } from "express";
import { 
  getAllAlumni,
  getAlumniById,
  createAlumni,
  updateAlumni,
  deleteAlumni 
} from "../controllers/alumni.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Route to get all alumni records
router.route("/")
  .get(verifyJWT, getAllAlumni);

// Route to create a new alumni record with optional image upload
router.route("/")
  .post(
    verifyJWT, // Secure route
    upload.fields([
      { name: "profileImage", maxCount: 1 }, // Handle profile image upload
      { name: "companyLogo", maxCount: 1 }   // Handle company logo upload
    ]),
    createAlumni
  );

// Routes for specific alumni by ID (get, update, delete)
router.route("/:id")
  .get(verifyJWT, getAlumniById)
  .put(
    verifyJWT, // Secure route
    upload.fields([
      { name: "profileImage", maxCount: 1 }, // Allow updating profile image
      { name: "companyLogo", maxCount: 1 }   // Allow updating company logo
    ]),
    updateAlumni
  )
  .delete(verifyJWT, deleteAlumni);

export default router;