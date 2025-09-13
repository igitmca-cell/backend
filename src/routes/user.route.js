import { Router } from "express";
import { loginUser, logoutUser, registerUser,refreshAccessToken,getCurrentUser, changeCurrentPassword, getAllBatchmates,registerToken,getAllCrCdcByBatch,makeCrCdc,pendingStudent,approveStudent} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();



router.route("/register").post(
    upload.fields([
        {name:"profileImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)


// secured routes
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/batchmate").post(verifyJWT,getAllBatchmates)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/user").post(verifyJWT,getCurrentUser)
router.route("/change-password").put(changeCurrentPassword)
router.route("/register-token").post(verifyJWT,registerToken)
router.route("/getAllCrCdc").post(verifyJWT,getAllCrCdcByBatch)
router.route("/makeCrCdc").post(verifyJWT,makeCrCdc)
router.route("/pending").get(verifyJWT,pendingStudent)
router.route("/approve").post(verifyJWT,approveStudent)


export default router