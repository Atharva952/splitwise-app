import express from "express";
import multer from "multer";
import auth from "../middleware/auth.js";
import { parseExpenseText, parseBillText, parseBillImage } from "../controllers/aiController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    if (!ok) {
      return cb(new Error("Only JPEG, PNG, WEBP images are allowed"));
    }
    return cb(null, true);
  }
});

router.post("/parse-expense-text", auth, parseExpenseText);
router.post("/parse-bill-text", auth, parseBillText);
router.post("/parse-bill-image", auth, upload.single("billImage"), parseBillImage);

router.use((err, req, res, next) => {
  if (!err) return next();
  return res.status(400).json({ message: err.message || "Invalid upload request" });
});

export default router;
