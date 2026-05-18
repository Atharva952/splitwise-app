import express from "express";
import auth from "../middleware/auth.js";
import { listUsers } from "../controllers/userController.js";

const router = express.Router();

router.get("/", auth, listUsers);

export default router;
