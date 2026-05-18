import mongoose from "mongoose";

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const to2 = (num) => Number(Number(num).toFixed(2));

export const validateExpensePayload = (payload) => {
  const errors = [];
  const {
    groupId,
    payer,
    amount,
    currency = "INR",
    description,
    date,
    splitMode,
    splits
  } = payload;

  if (!groupId || !isValidObjectId(groupId)) {
    errors.push("groupId is required and must be a valid id");
  }

  if (!payer || !isValidObjectId(payer)) {
    errors.push("payer is required and must be a valid id");
  }

  if (amount === undefined || typeof amount !== "number" || amount <= 0) {
    errors.push("amount must be a number greater than 0");
  }

  if (typeof currency !== "string" || currency.trim().length !== 3) {
    errors.push("currency must be a 3-letter string");
  }

  if (
    typeof description !== "string" ||
    description.trim().length < 2 ||
    description.trim().length > 300
  ) {
    errors.push("description must be 2 to 300 characters");
  }

  if (!date || Number.isNaN(new Date(date).getTime())) {
    errors.push("date must be a valid date");
  }

  if (!["equal", "exact", "percentage"].includes(splitMode)) {
    errors.push("splitMode must be one of: equal, exact, percentage");
  }

  if (!Array.isArray(splits) || splits.length === 0) {
    errors.push("splits must be a non-empty array");
  } else {
    const seenUsers = new Set();
    let sum = 0;
    for (const split of splits) {
      if (!split || typeof split !== "object") {
        errors.push("Each split must be an object");
        continue;
      }

      if (!split.user || !isValidObjectId(split.user)) {
        errors.push("Each split.user must be a valid user id");
      } else if (seenUsers.has(split.user)) {
        errors.push("Duplicate user in splits is not allowed");
      } else {
        seenUsers.add(split.user);
      }

      if (typeof split.value !== "number" || split.value < 0) {
        errors.push("Each split.value must be a number >= 0");
      } else {
        sum += split.value;
      }
    }

    if (splitMode === "percentage") {
      if (to2(sum) !== 100) {
        errors.push("For percentage mode, splits must sum to 100");
      }
    } else if (typeof amount === "number" && amount > 0) {
      if (to2(sum) !== to2(amount)) {
        errors.push("Splits must sum exactly to total amount");
      }
    }
  }

  return errors;
};
