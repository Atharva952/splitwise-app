import express from "express";
import auth from "../middleware/auth.js";
import { createExpense, listGroupExpenses } from "../controllers/expenseController.js";

const router = express.Router();

router.post("/", auth, createExpense);
router.get("/group/:groupId", auth, listGroupExpenses);

export default router;
