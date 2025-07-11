import { Router } from "express";
import { addSemesterResource, getSemesterResources } from "../controllers/resource.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Route to add a semester resource (notes or question paper)
router.route("/resources").post(
  verifyJWT, // Secure route
  upload.fields([
    {name:"file",
        maxCount: 1
    }
]), // Handle single file upload with field name "file"
  addSemesterResource
);

// Route to fetch all semester resources (notes and question papers)
router.route("/resources").get(verifyJWT, getSemesterResources);

export default router;