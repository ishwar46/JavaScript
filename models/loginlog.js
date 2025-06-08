const mongoose = require("mongoose");
const loginLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  email: { type: String, required: true },
  fullName: { type: String },
  isSuccess: { type: Boolean, required: true },
  ip: { type: String },
  userAgent: { type: String },
  status: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const LoginLog = mongoose.model("LoginLog", loginLogSchema);
module.exports = LoginLog;
