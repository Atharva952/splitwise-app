import Expense from "../models/Expense.js";
import Group from "../models/Group.js";
import { validateExpensePayload, to2 } from "../utils/validators.js";

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

const hasId = (list = [], userId) => {
  const target = getId(userId);
  return list.some((item) => getId(item) === target);
};

const ensureGroupUser = (group, userId) =>
  hasId(group.members, userId) ||
  hasId(group.admins, userId) ||
  getId(group.createdBy) === getId(userId);

export const createExpense = async (req, res) => {
  try {
    const errors = validateExpensePayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const { groupId, payer, amount, currency, description, date, splitMode, splits } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const requesterId = req.user._id;
    if (!ensureGroupUser(group, requesterId)) {
      return res.status(403).json({ message: "You are not allowed in this group" });
    }

    if (!ensureGroupUser(group, payer)) {
      return res.status(400).json({ message: "Payer must be a group user (member/admin)" });
    }

    const allSplitMembers = splits.every((s) => ensureGroupUser(group, s.user));
    if (!allSplitMembers) {
      return res.status(400).json({ message: "All split users must be group users (member/admin)" });
    }

    if (splitMode === "equal") {
      const expected = to2(amount / splits.length);
      const values = splits.map((s) => to2(s.value));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const hasInvalidEqual = to2(max - min) > 0.01 || values.some((v) => Math.abs(v - expected) > 0.01);
      if (hasInvalidEqual) {
        return res.status(400).json({
          message: "For equal mode, each split must have equal share based on amount"
        });
      }
    }

    const expense = await Expense.create({
      group: groupId,
      payer,
      amount,
      currency: (currency || "INR").toUpperCase(),
      description: description.trim(),
      date: new Date(date),
      splitMode,
      splits,
      createdBy: requesterId
    });

    const fullExpense = await Expense.findById(expense._id)
      .populate("payer", "username email")
      .populate("splits.user", "username email")
      .populate("createdBy", "username email");

    return res.status(201).json(fullExpense);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create expense" });
  }
};

export const listGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!ensureGroupUser(group, req.user._id)) {
      return res.status(403).json({ message: "You are not allowed in this group" });
    }

    const expenses = await Expense.find({ group: groupId })
      .populate("payer", "username email")
      .populate("splits.user", "username email")
      .sort({ date: -1, createdAt: -1 });

    return res.json(expenses);
  } catch (error) {
    return res.status(500).json({ message: "Failed to list expenses" });
  }
};
