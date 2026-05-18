import Group from "../models/Group.js";
import { generateStructured, generateStructuredFromImage } from "../services/geminiService.js";
import { to2, validateExpensePayload } from "../utils/validators.js";

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

const normalize = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getEmailPrefix = (email = "") => (email.includes("@") ? email.split("@")[0] : email);

const buildMemberIndex = (members) =>
  members.map((member) => {
    const aliases = [member.username, getEmailPrefix(member.email)]
      .filter(Boolean)
      .map(normalize);
    return { member, aliases };
  });

const inferRequesterPaid = (text = "") => /\b(i|me|myself)\s+paid\b/i.test(text) || /\bpaid by\s+(me|i|myself)\b/i.test(text);

const splitAmountAcrossUsers = (amount, userIds) => {
  if (!amount || !Array.isArray(userIds) || userIds.length === 0) return [];
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / userIds.length);
  let remainder = cents - base * userIds.length;
  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      user: userId,
      value: (base + extra) / 100
    };
  });
};

const sumSplitValues = (splits = []) =>
  Number(splits.reduce((acc, split) => acc + Number(split.value || 0), 0).toFixed(2));

const inferSplitUsersFromText = (text = "", memberIndex = [], requesterId = "") => {
  const match = text.match(/\bsplit(?:\s+equally)?\s+(?:between|among)\s+(.+?)(?:[.!?]|$)/i);
  if (!match?.[1]) return [];

  const rawChunk = match[1];
  const parts = rawChunk
    .split(/,| and | & |\+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const ids = [];
  parts.forEach((part) => {
    const id = mapMemberNameToId(part, memberIndex, requesterId);
    if (id && !ids.includes(id)) ids.push(id);
  });

  return ids;
};

const mapMemberNameToId = (name, memberIndex, requesterId) => {
  const input = normalize(name);
  if (!input) return null;
  if (["me", "i", "myself"].includes(input) && requesterId) {
    return requesterId;
  }

  const exact = memberIndex.find((m) => m.aliases.includes(input));
  if (exact) return exact.member._id.toString();

  const partial = memberIndex.find((m) => m.aliases.some((alias) => alias.includes(input) || input.includes(alias)));
  return partial ? partial.member._id.toString() : null;
};

const expenseTextSchema = {
  type: "object",
  properties: {
    payer_name: { type: ["string", "null"] },
    amount: { type: "number" },
    currency: { type: "string" },
    description: { type: "string" },
    date: { type: "string", format: "date" },
    split_mode: { type: "string", enum: ["equal", "exact", "percentage"] },
    splits: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          member_name: { type: "string" },
          value: { type: "number" }
        },
        required: ["member_name", "value"]
      }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: ["payer_name", "amount", "currency", "description", "date", "split_mode", "splits", "confidence"]
};

const billTextSchema = {
  type: "object",
  properties: {
    merchant: { type: ["string", "null"] },
    currency: { type: "string" },
    date: { type: ["string", "null"], format: "date" },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    service_charge: { type: ["number", "null"] },
    total: { type: "number" },
    line_items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit_price: { type: ["number", "null"] },
          amount: { type: "number" }
        },
        required: ["label", "amount"]
      }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: ["currency", "total", "line_items", "confidence"]
};

const billImageSchema = {
  type: "object",
  properties: {
    ocr_text: { type: "string" },
    merchant: { type: ["string", "null"] },
    currency: { type: "string" },
    date: { type: ["string", "null"], format: "date" },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    service_charge: { type: ["number", "null"] },
    total: { type: "number" },
    line_items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit_price: { type: ["number", "null"] },
          amount: { type: "number" }
        },
        required: ["label", "amount"]
      }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: ["ocr_text", "currency", "total", "line_items", "confidence"]
};

const coerceExpenseDraft = (draft) => ({
  payer: draft.payer || "",
  amount: Number(draft.amount || 0),
  currency: (draft.currency || "INR").toUpperCase(),
  description: draft.description || "",
  date: draft.date || new Date().toISOString().slice(0, 10),
  splitMode: draft.splitMode || "exact",
  splits: Array.isArray(draft.splits)
    ? draft.splits.map((s) => ({ user: s.user || "", value: Number(s.value || 0) }))
    : []
});

export const parseExpenseText = async (req, res) => {
  try {
    const { groupId, text, defaultCurrency = "INR" } = req.body;

    if (!groupId || typeof groupId !== "string") {
      return res.status(400).json({ message: "groupId is required" });
    }
    if (typeof text !== "string" || text.trim().length < 8) {
      return res.status(400).json({ message: "text must be at least 8 characters" });
    }

    const group = await Group.findById(groupId)
      .populate("members", "username email")
      .populate("admins", "username email")
      .populate("createdBy", "username email");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureGroupUser(group, req.user._id)) {
      console.error("parseExpenseText unauthorized", {
        groupId,
        requesterId: getId(req.user._id),
        createdBy: getId(group.createdBy),
        memberIds: (group.members || []).map((m) => getId(m)),
        adminIds: (group.admins || []).map((a) => getId(a))
      });
      return res.status(403).json({ message: "You are not allowed in this group" });
    }

    const groupUsersMap = new Map();
    [...(group.members || []), ...(group.admins || [])].forEach((u) => {
      if (u?._id) groupUsersMap.set(u._id.toString(), u);
    });
    if (group.createdBy?._id) {
      groupUsersMap.set(group.createdBy._id.toString(), group.createdBy);
    }
    const groupUsers = [...groupUsersMap.values()];

    const memberIndex = buildMemberIndex(groupUsers);
    const memberNames = groupUsers.map((m) => `${m.username} (${m.email})`).join(", ");
    const today = new Date().toISOString().slice(0, 10);

    const prompt = [
      "Convert the user's expense note into structured JSON for an expense tracker.",
      `Today's date is ${today}. Resolve relative dates like 'last night' to YYYY-MM-DD.`,
      `Default currency is ${String(defaultCurrency).toUpperCase()}.`,
      "Use only these known group members when possible:",
      memberNames,
      "Rules:",
      "- Extract one expense draft only.",
      "- split_mode must be equal, exact, or percentage.",
      "- For percentage mode, values should add to 100.",
      "- For exact/equal mode, split values should add to total amount.",
      "- If text says 'me' or 'I', use member_name 'me' for that person.",
      "- If payer cannot be identified, set payer_name to null.",
      "- Keep description short and clear.",
      `User text: """${text.trim()}"""`
    ].join("\n");

    const structured = await generateStructured({ prompt, schema: expenseTextSchema });

    const requesterId = req.user._id.toString();
    let payerId = structured.payer_name
      ? mapMemberNameToId(structured.payer_name, memberIndex, requesterId)
      : null;
    if (!payerId && inferRequesterPaid(text)) {
      payerId = requesterId;
    }

    const unresolvedMembers = [];
    let mappedSplits = (structured.splits || []).map((split) => {
      const userId = mapMemberNameToId(split.member_name, memberIndex, requesterId);
      if (!userId) {
        unresolvedMembers.push(split.member_name);
      }
      return {
        user: userId || "",
        value: Number(split.value || 0),
        memberName: split.member_name
      };
    });

    const inferredSplitUserIds = inferSplitUsersFromText(text, memberIndex, requesterId);
    const hasEmptySplitUser = mappedSplits.some((s) => !s.user);
    const mappedUserIds = [...new Set(mappedSplits.map((s) => s.user).filter(Boolean))];
    const amountNum = Number(structured.amount || 0);

    if (
      structured.split_mode === "equal" &&
      inferredSplitUserIds.length >= 2 &&
      (mappedSplits.length <= 1 || hasEmptySplitUser)
    ) {
      unresolvedMembers.length = 0;
      mappedSplits = splitAmountAcrossUsers(amountNum, inferredSplitUserIds).map((s) => ({
        ...s,
        memberName: ""
      }));
    }

    if (structured.split_mode === "equal" && amountNum > 0) {
      const currentSum = sumSplitValues(mappedSplits);
      const shouldRebuild =
        mappedUserIds.length >= 2 &&
        (hasEmptySplitUser || currentSum !== Number(amountNum.toFixed(2)));

      if (shouldRebuild) {
        unresolvedMembers.length = 0;
        mappedSplits = splitAmountAcrossUsers(amountNum, mappedUserIds).map((s) => ({
          ...s,
          memberName: ""
        }));
      }
    }

    const draft = coerceExpenseDraft({
      payer: payerId || "",
      amount: structured.amount,
      currency: structured.currency,
      description: structured.description,
      date: structured.date,
      splitMode: structured.split_mode,
      splits: mappedSplits
    });

    const validationErrors = validateExpensePayload({
      groupId,
      payer: draft.payer,
      amount: draft.amount,
      currency: draft.currency,
      description: draft.description,
      date: draft.date,
      splitMode: draft.splitMode,
      splits: draft.splits
    });

    return res.json({
      draft,
      aiMeta: {
        confidence: Number(structured.confidence || 0),
        notes: structured.notes || [],
        unresolvedMembers,
        isReadyToSave: validationErrors.length === 0
      },
      validationErrors
    });
  } catch (error) {
    console.error("parseExpenseText failed:", error);
    return res.status(500).json({ message: "Failed to parse expense text", error: error.message });
  }
};

export const parseBillText = async (req, res) => {
  try {
    const { groupId, text, defaultCurrency = "INR" } = req.body;
    if (!groupId || typeof groupId !== "string") {
      return res.status(400).json({ message: "groupId is required" });
    }
    if (typeof text !== "string" || text.trim().length < 8) {
      return res.status(400).json({ message: "text must be at least 8 characters" });
    }

    const group = await Group.findById(groupId)
      .populate("members", "username email")
      .populate("admins", "username email")
      .populate("createdBy", "username email");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureGroupUser(group, req.user._id)) {
      return res.status(403).json({ message: "You are not allowed in this group" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const prompt = [
      "Parse this bill/receipt text into structured JSON for expense splitting.",
      `Today's date is ${today}.`,
      `If currency is not clear, use ${String(defaultCurrency).toUpperCase()}.`,
      "Extract line items and total. If total is missing, estimate total as sum of line items.",
      `Bill text: """${text.trim()}"""`
    ].join("\n");

    const structured = await generateStructured({ prompt, schema: billTextSchema });
    const lineItems = (structured.line_items || []).map((item) => ({
      label: item.label,
      quantity: item.quantity == null ? null : Number(item.quantity),
      unitPrice: item.unit_price == null ? null : Number(item.unit_price),
      amount: Number(item.amount || 0)
    }));

    const sum = to2(lineItems.reduce((acc, item) => acc + Number(item.amount || 0), 0));
    const parsedTotal = Number(structured.total || 0);
    const total = parsedTotal > 0 ? parsedTotal : sum;

    return res.json({
      bill: {
        merchant: structured.merchant || "",
        currency: (structured.currency || defaultCurrency).toUpperCase(),
        date: structured.date || today,
        subtotal: structured.subtotal == null ? null : Number(structured.subtotal),
        tax: structured.tax == null ? null : Number(structured.tax),
        serviceCharge: structured.service_charge == null ? null : Number(structured.service_charge),
        total,
        lineItems
      },
      aiMeta: {
        confidence: Number(structured.confidence || 0),
        notes: structured.notes || [],
        totalFromItems: sum
      }
    });
  } catch (error) {
    console.error("parseBillText failed:", error);
    return res.status(500).json({ message: "Failed to parse bill text", error: error.message });
  }
};

export const parseBillImage = async (req, res) => {
  try {
    const { groupId, defaultCurrency = "INR" } = req.body;
    const file = req.file;

    if (!groupId || typeof groupId !== "string") {
      return res.status(400).json({ message: "groupId is required" });
    }
    if (!file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const group = await Group.findById(groupId)
      .populate("members", "username email")
      .populate("admins", "username email")
      .populate("createdBy", "username email");
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!ensureGroupUser(group, req.user._id)) {
      return res.status(403).json({ message: "You are not allowed in this group" });
    }

    const mimeType = file.mimetype;
    const imageBase64 = file.buffer.toString("base64");
    const today = new Date().toISOString().slice(0, 10);
    const prompt = [
      "You are an OCR and bill parser.",
      "First, read all visible text from this bill image and output it in ocr_text.",
      "Then extract structured billing data.",
      `Today's date is ${today}.`,
      `If currency is unclear, use ${String(defaultCurrency).toUpperCase()}.`,
      "Return line items with the most accurate amount possible.",
      "If total is not clearly present, estimate total as sum(line_items.amount)."
    ].join("\n");

    const structured = await generateStructuredFromImage({
      prompt,
      schema: billImageSchema,
      imageBase64,
      mimeType
    });

    const lineItems = (structured.line_items || []).map((item) => ({
      label: item.label,
      quantity: item.quantity == null ? null : Number(item.quantity),
      unitPrice: item.unit_price == null ? null : Number(item.unit_price),
      amount: Number(item.amount || 0)
    }));

    const sum = to2(lineItems.reduce((acc, item) => acc + Number(item.amount || 0), 0));
    const parsedTotal = Number(structured.total || 0);
    const total = parsedTotal > 0 ? parsedTotal : sum;

    return res.json({
      bill: {
        merchant: structured.merchant || "",
        currency: (structured.currency || defaultCurrency).toUpperCase(),
        date: structured.date || today,
        subtotal: structured.subtotal == null ? null : Number(structured.subtotal),
        tax: structured.tax == null ? null : Number(structured.tax),
        serviceCharge: structured.service_charge == null ? null : Number(structured.service_charge),
        total,
        lineItems
      },
      ocrText: structured.ocr_text || "",
      aiMeta: {
        confidence: Number(structured.confidence || 0),
        notes: structured.notes || [],
        totalFromItems: sum
      }
    });
  } catch (error) {
    console.error("parseBillImage failed:", error);
    return res.status(500).json({ message: "Failed to parse bill image", error: error.message });
  }
};
