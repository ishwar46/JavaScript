const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema({
  OTP: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 180,
  },
  email: {
    type: String,
  },
  mobileNumber: {
    type: String,
  },
  OTPRequests: {
    type: Number,
    default: 1,
  },
  OTPAttempts: {
    type: Number,
    default: 0,
  },
});
const OTPDetailsSchema = new mongoose.Schema({
  OTPDetails: [OTPSchema],
});

const OTP = mongoose.model("OTP", OTPDetailsSchema);
module.exports = OTP;
