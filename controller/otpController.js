const { OTPGenerationEmail } = require("../emailTemplates/OTPGenerationEmail");
const OTP = require("../models/otp");
const User = require("../models/user");
const { sendEmail } = require("../utils/nodeMailer");
const { sendSMS } = require("../utils/smsSender");
const generateRandomKey = require("../utils/RandomPass");

const generateOTP = async (req, res) => {
  try {
    const { email, mobileNumber } = req.body;

    const user = await User.findOne({
      $or: [{ email }, { mobileNumber }],
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const newOTP = generateRandomKey(6).trim();

    let otpRecord = await OTP.findOne({ "OTPDetails.email": email });

    if (!otpRecord) {
      otpRecord = new OTP({
        OTPDetails: [{ OTP: newOTP, email, mobileNumber }],
      });
    } else {
      let otpRequests = otpRecord.OTPDetails[0].OTPRequests + 1;
      const createdAt = new Date(otpRecord.OTPDetails[0].createdAt);
      const now = new Date();

      const diffInSeconds = (now - createdAt) / 1000;
      if (diffInSeconds < 60) {
        return res.status(400).json({
          success: false,
          message: "Please wait before sending new OTP",
        });
      }

      if (otpRequests > 3) {
        return res.status(400).json({
          success: false,
          message:
            "You have exceeded the maximum number of OTP requests. Please contact admin.",
        });
      }

      otpRecord.OTPDetails = otpRecord.OTPDetails.filter(
        (detail) => detail.email !== email
      );

      otpRecord.OTPDetails.push({
        OTP: newOTP,
        email,
        mobileNumber,
        OTPRequests: otpRequests,
      });
    }

    await otpRecord.save();

    if (user.email) {
      await sendEmail({
        from: "tiu.kmc@gmail.com",
        to: user.email,
        subject: "OTP Generated Successfully",
        html: OTPGenerationEmail(user.email, newOTP),
      });
    }
    if (mobileNumber) {
      const smsText = `Use OTP ${newOTP} to complete your SEEP Mela 2082 registration. This code will expire in 5 minutes. Do not share it with anyone. - KMC SEEP MELA 2082`;

      await sendSMS({
        to: mobileNumber,
        text: smsText,
      });
    }

    return res.status(201).json({
      success: true,
      message: "New OTP generated and sent to your available contact(s).",
    });
  } catch (error) {
    console.error("OTP Generation Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const showOTPDetails = async (req, res) => {
  try {
    const { emailOrMobileNumber } = req.body;

    const otpDoc = await OTP.findOne({
      $or: [
        { "OTPDetails.email": emailOrMobileNumber },
        { "OTPDetails.mobileNumber": emailOrMobileNumber },
      ],
    });

    if (!otpDoc || !otpDoc.OTPDetails.length) {
      return res.status(404).json({ success: false, message: "OTP not found" });
    }

    // Find the relevant OTP entry from the array
    const relevantOTP = otpDoc.OTPDetails.find(
      (otp) =>
        otp.email === emailOrMobileNumber ||
        otp.mobileNumber === emailOrMobileNumber
    );

    if (!relevantOTP) {
      return res.status(404).json({ success: false, message: "OTP not found" });
    }

    // Calculate expiry time (180 seconds from createdAt)
    const expiryTime = new Date(relevantOTP.createdAt.getTime() + 180 * 1000);

    // Return only the requested fields
    return res.status(200).json({
      success: true,
      data: {
        createdAt: relevantOTP.createdAt,
        expiryTime: expiryTime,
        OTPAttempts: relevantOTP.OTPAttempts,
        OTPRequests: relevantOTP.OTPRequests,
      },
    });
  } catch (error) {
    console.error("OTP Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { otp, emailOrMobileNumber } = req.body;

    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }

    const user = await User.findOne({
      $or: [
        { email: emailOrMobileNumber },
        { mobileNumber: emailOrMobileNumber },
      ],
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const otpRecord = await OTP.findOne({
      $or: [
        { "OTPDetails.email": emailOrMobileNumber },
        { "OTPDetails.mobileNumber": emailOrMobileNumber },
      ],
    });
    if (!otpRecord || otpRecord.OTPDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Your OTP has expired or couldn't be found. Please request a new one.",
      });
    }

    const latestOTP = otpRecord.OTPDetails[otpRecord.OTPDetails.length - 1];

    if (latestOTP.OTP !== otp) {
      latestOTP.OTPAttempts = (latestOTP.OTPAttempts || 0) + 1;
      await otpRecord.save();

      const attemptsRemaining = 5 - latestOTP.OTPAttempts;
      if (attemptsRemaining <= 0) {
        user.isLocked = true;
        return res.status(403).json({
          success: false,
          message:
            "Too many incorrect attempts. Please contact support or request a new one",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining,
      });
    }

    const now = new Date();
    const otpTime = new Date(latestOTP.createdAt);
    const diffMinutes = Math.floor((now - otpTime) / (1000 * 60));

    if (diffMinutes > 5) {
      latestOTP.OTP = "";
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // OTP is valid
    user.OTPVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. Your account is now verified.",
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { generateOTP, verifyOTP, showOTPDetails };
