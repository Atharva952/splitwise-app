import User from "../models/User.js";

export const listUsers = async (req, res) => {
  try {
    const query = (req.query.query || "").trim();
    const filter = query
      ? {
          $or: [
            { username: { $regex: query, $options: "i" } },
            { email: { $regex: query, $options: "i" } }
          ]
        }
      : {};

    const users = await User.find(filter).select("username email").limit(30);
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};
