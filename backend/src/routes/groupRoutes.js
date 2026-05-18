import express from "express";
import auth from "../middleware/auth.js";
import {
  createGroup,
  listMyGroups,
  addGroupMember,
  removeGroupMember,
  deleteGroup
} from "../controllers/groupController.js";

const router = express.Router();

router.post("/", auth, createGroup);
router.get("/", auth, listMyGroups);
router.patch("/:groupId/members/add", auth, addGroupMember);
router.patch("/:groupId/members/remove", auth, removeGroupMember);
router.delete("/:groupId", auth, deleteGroup);

export default router;
