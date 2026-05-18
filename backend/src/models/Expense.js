import mongoose from "mongoose";

const splitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true
    },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "INR"
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 300
    },
    date: {
      type: Date,
      required: true
    },
    splitMode: {
      type: String,
      enum: ["equal", "exact", "percentage"],
      required: true
    },
    splits: {
      type: [splitSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one split is required"
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
