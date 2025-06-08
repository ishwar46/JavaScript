const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    // ==================== BASIC PERSONAL INFORMATION ====================
    fullName: {
      type: String,
      required: true
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"]
    },
    profilePicture: {
      type: String
    },

    // ==================== CONTACT INFORMATION ====================
    mobileNumber: {
      type: String,
      required: true
    },
    email: {
      type: String
    },
    address: {
      type: String,
      required: true
    },

    // ==================== AUTHENTICATION & SECURITY ====================
    password: {
      type: String,
      required: true
    },
    passwordChanged: {
      type: Boolean,
      default: false
    },
    OTPVerified: {
      type: Boolean,
      default: false
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    fcmToken: {
      type: String
    },

    // ==================== ROLES & PERMISSIONS ====================
    role: {
      type: String,
      enum: ["user", "admin", "volunteer", "coordinator", "superadmin"],
      default: "user"
    },
    adminVerification: {
      accountStatus: {
        type: String,
        enum: ["pending", "selected", "accepted"],
        default: "pending"
      }
    },

    // ==================== INSTITUTIONAL INFORMATION ====================
    institution: {
      type: String
    },
    applicantId: {
      type: String
    },

    // ==================== ATTENDANCE & SESSION TRACKING ====================
    attendanceCheckIn: [
      {
        date: {
          type: Date,
          default: Date.now
        },
        status: {
          type: Boolean
        }
      }
    ],
    attendanceCheckOut: [
      {
        date: {
          type: Date,
          default: Date.now
        },
        status: {
          type: Boolean
        }
      }
    ],
    sessionsAttended: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session"
      }
    ]
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);
module.exports = User;