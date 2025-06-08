const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    classroomNumber: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "running", "completed", "cancelled"],
      default: "upcoming",
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instructor",
    },
    classTime: {
      type: String,
      enum: ["morning", "afternoon", "day"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      enum: [15, 30],
      required: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    attendance: [
      {
        date: { type: Date, required: true },
        dayNumber: { type: Number, required: true },
        studentAttendance: [
          {
            studentId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            status: {
              type: Boolean,
              default: false,
              required: true,
            },
            markedAt: {
              type: Date,
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// Pre-save hook to calculate end date based on start date and duration
classSchema.pre("save", function (next) {
  if (this.isModified("startDate") || this.isModified("duration")) {
    const endDate = new Date(this.startDate);
    endDate.setDate(endDate.getDate() + this.duration);
    this.endDate = endDate;
  }
  next();
});

module.exports = mongoose.model("Class", classSchema);
