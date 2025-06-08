const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    // Login Info
    password: { type: String, required: true },
    passwordChanged: { type: Boolean, default: false },

    fullName: { type: String, required: true },

    // Basic Personal Info
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    dateOfBirth: { type: String },
    age: { type: Number },
    ethnicity: { type: String },
    maritalStatus: { type: String },
    caste: { type: String },
    skillLevel: { type: String },

    marksBreakdown: {
      gender: {
        value: String,
        marks: Number,
      },
      age: {
        value: Number,
        marks: Number,
      },
      streetVendor: {
        value: Boolean,
        marks: Number,
      },
      disabilityStatus: {
        value: String,
        marks: Number,
      },
      ethnicity: {
        value: String,
        marks: Number,
      },
      residency: {
        value: String,
        marks: Number,
      },
      education: {
        value: String,
        marks: Number,
      },
      interview: {
        value: String,
        marks: Number,
      },
      lastYearApplicant: {
        value: {
          registeredPrev: mongoose.Schema.Types.Mixed,
          alreadyTakenTraining: mongoose.Schema.Types.Mixed,
        },
        marks: Number,
      },
    },

    // Citizenship Info
    citizenshipNumber: { type: String, required: true },
    citizenshipIssueDate: { type: String },
    citizenshipIssuedDistrict: { type: String },

    // Contact Information
    mobileNumber: { type: String, required: true },
    alternativeContactNumber: { type: String },
    email: { type: String },

    // Permanent Address
    permanentProvince: { type: String },
    permanentDistrict: { type: String },
    permanentMunicipality: { type: String },
    permanentWardNo: { type: String },

    // Temporary Address
    sameAsPermanent: { type: Boolean, default: false },
    temporaryProvince: { type: String },
    temporaryDistrict: { type: String },
    temporaryMunicipality: { type: String },
    temporaryWardNo: { type: String },

    // Education
    educationLevel: { type: String },

    // Sector of Interest
    sectorOfInterest: { type: String },
    selectedOccupations: [{ type: String }],

    // Special Status Flags
    disabilityStatus: { type: Boolean, default: false },
    disabilityClass: { type: String },
    streetVendor: { type: Boolean, default: false },

    taxPayerStatus: { type: Boolean, default: false },
    taxPayerNumber: { type: String, default: "" },

    isFromSpecialLocation: { type: Boolean, default: false },
    prevRegVerified: { type: Boolean, default: false },
    landfillSiteResident: { type: Boolean, default: false },
    registeredPrev: { type: Boolean, default: false },
    alreadyTakenTraining: { type: Boolean, default: false },

    //Marks Obtained
    marksObtained: { type: Number, default: 0 },
    interviewMarks: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },

    // File Uploads
    targetCountry: { type: String },
    trainingDetails: { type: String },
    profilePicture: { type: String },
    citizenshipFront: { type: String },
    citizenshipBack: { type: String },
    disabilityEvidence: { type: String },

    role: {
      type: String,
      enum: ["user", "admin", "volunteer", "coordinator", "superadmin"],
      default: "user",
    },

    adminVerification: {
      accountStatus: {
        type: String,
        enum: [
          "pending",
          "verified",
          "shortlisted",
          "selected",
          "accepted",
          "assigned",
          "rejected",
          "dropped",
        ],
        default: "pending",
      },
    },

    applicantId: { type: String },

    // OTP & Login
    OTPVerified: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    fcmToken: { type: String },

    // Attendance & Sessions
    attendanceCheckIn: [
      {
        date: { type: Date, default: Date.now },
        status: { type: Boolean },
      },
    ],
    attendanceCheckOut: [
      {
        date: { type: Date, default: Date.now },
        status: { type: Boolean },
      },
    ],
    onTimeRegistration: { type: Boolean, default: false },
    sessionsAttended: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Session",
      },
    ],

    // Orientation Attendance
    classAttendance: {
      attended: { type: Boolean, default: false },
      checkedInAt: { type: Date },
      checkedInBy: {
        id: { type: mongoose.Schema.Types.ObjectId },
        role: { type: String, enum: ["admin", "volunteer"] },
      },
    },
    courseCounselAttendance: {
      attended: { type: Boolean, default: false },
      checkedInAt: { type: Date },
      checkedInBy: {
        id: { type: mongoose.Schema.Types.ObjectId },
        role: { type: String, enum: ["admin", "volunteer"] },
      },
    },
    orientationAttendance: {
      attended: { type: Boolean, default: false },
      checkedInAt: { type: Date },
      checkedInBy: {
        id: { type: mongoose.Schema.Types.ObjectId },
        role: { type: String, enum: ["admin", "volunteer"] },
      },
    },
    careerCounselAttendance: {
      attended: { type: Boolean, default: false },
      checkedInAt: { type: Date },
      checkedInBy: {
        id: { type: mongoose.Schema.Types.ObjectId },
        role: { type: String, enum: ["admin", "volunteer"] },
      },
    },
    entrepreneurAttendance: {
      attended: { type: Boolean, default: false },
      checkedInAt: { type: Date },
      checkedInBy: {
        id: { type: mongoose.Schema.Types.ObjectId },
        role: { type: String, enum: ["admin", "volunteer"] },
      },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
