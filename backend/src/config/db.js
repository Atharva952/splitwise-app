import mongoose from "mongoose";

const connectDB = async () => {
  const { MONGODB_URI } = process.env;
  const dbName = "splitwise";

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(MONGODB_URI, { dbName });
  console.log("MongoDB connected");
};

export default connectDB;
