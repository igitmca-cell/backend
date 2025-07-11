import { Router } from "express";
import { createNotice,editNotice,deleteNotice ,getAllNotices} from "../controllers/notice.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public route
router.route("/").get(getAllNotices);

// Restricted routes (e.g., for admins)
router.route("/create").post( createNotice);
router.route("/edit/:noticeId").put(editNotice);
router.route("/delete/:noticeId").delete( deleteNotice);

export default router;