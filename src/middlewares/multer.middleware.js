import multer from "multer";
import fs from "fs";
import path from "path";

// Resolve the absolute path to public/temp
const uploadDir = path.join(process.cwd(), "public", "temp");

// Ensure the directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // recursive: true creates parent dirs if needed
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use absolute path
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Keep original filename from client
  },
});

export const upload = multer({
  storage,
});