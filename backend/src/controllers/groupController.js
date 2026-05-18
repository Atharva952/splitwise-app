import Group from "../models/Group.js";
import Expense from "../models/Expense.js";
import User from "../models/User.js";
import { isValidObjectId } from "../utils/validators.js";

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id && value._id !== value) {
    return getId(value._id);
  }
  if (typeof value === "object" && typeof value.toHexString === "function") {
    return value.toHexString();
  }
  if (typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  if (typeof value.toString === "function") return String(value.toString());
  return "";
};

const hasId = (list = [], id) => {
  const target = getId(id);
  return list.some((item) => getId(item) === target);
};

const getPopulatedGroup = (groupId) =>
  Group.findById(groupId)
    .populate("createdBy", "username email")
    .populate("admins", "username email")
    .populate("members", "username email");

const ensureAdmin = (group, userId) =>
  hasId(group.admins, userId) || getId(group.createdBy) === getId(userId);

export const createGroup = async (req, res) => {
  try {
    const { name, description = "", memberIds = [] } = req.body;

    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ message: "name must be 2 to 100 characters" });
    }

    if (typeof description !== "string" || description.length > 500) {
      return res.status(400).json({ message: "description must be up to 500 characters" });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "memberIds must be an array" });
    }

    const creatorId = req.user._id.toString();
    const cleanedIds = [...new Set(memberIds.filter((id) => typeof id === "string").map((id) => id.trim()))];
    cleanedIds.push(creatorId);
    const finalIds = [...new Set(cleanedIds)];

    if (finalIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "All memberIds must be valid user ids" });
    }

    const users = await User.find({ _id: { $in: finalIds } }).select("_id");
    if (users.length !== finalIds.length) {
      return res.status(400).json({ message: "One or more memberIds do not exist" });
    }

    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      createdBy: creatorId,
      admins: [creatorId],
      members: finalIds
    });

    const fullGroup = await getPopulatedGroup(group._id);
    return res.status(201).json(fullGroup);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create group" });
  }
};

export const listMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      $or: [{ members: userId }, { admins: userId }, { createdBy: userId }]
    })
      .populate("createdBy", "username email")
      .populate("admins", "username email")
      .populate("members", "username email")
      .sort({ createdAt: -1 });

    return res.json(groups);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch groups" });
  }
};

export const addGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }
    if (!memberId || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "memberId is required and must be valid" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureAdmin(group, req.user._id)) {
      return res.status(403).json({ message: "Only group admins can add members" });
    }

    const user = await User.findById(memberId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (hasId(group.members, memberId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    group.members.push(memberId);
    await group.save();

    const updated = await getPopulatedGroup(group._id);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to add member" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }
    if (!memberId || !isValidObjectId(memberId)) {
      return res.status(400).json({ message: "memberId is required and must be valid" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureAdmin(group, req.user._id)) {
      return res.status(403).json({ message: "Only group admins can remove members" });
    }
    if (!hasId(group.members, memberId)) {
      return res.status(400).json({ message: "User is not a member of this group" });
    }
    if (getId(group.createdBy) === getId(memberId)) {
      return res.status(400).json({ message: "Group creator cannot be removed" });
    }

    group.members = group.members.filter((id) => id.toString() !== memberId.toString());
    group.admins = (group.admins || []).filter((id) => id.toString() !== memberId.toString());
    await group.save();

    const updated = await getPopulatedGroup(group._id);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove member" });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureAdmin(group, req.user._id)) {
      return res.status(403).json({ message: "Only group admins can delete this group" });
    }

    await Promise.all([Group.deleteOne({ _id: groupId }), Expense.deleteMany({ group: groupId })]);
    return res.json({ message: "Group deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete group" });
  }
};
