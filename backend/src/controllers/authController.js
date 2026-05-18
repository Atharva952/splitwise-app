import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { isValidEmail } from "../utils/validators.js";

const createToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (
      typeof username !== "string" ||
      username.trim().length < 3 ||
      username.trim().length > 50
    ) {
      return res.status(400).json({ message: "username must be 3 to 50 characters" });
    }

    if (typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashed
    });

    const token = createToken(user._id.toString());
    return res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createToken(user._id.toString());
    return res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
};
