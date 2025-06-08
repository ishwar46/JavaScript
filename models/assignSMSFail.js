const mongoose = require("mongoose");

const smsFailedAttemptSchema = new mongoose.Schema(
  {
    phoneNumbers: [
      {
        type: String,
        required: true,
      },
    ],

    message: {
      type: String,
      required: true,
    },

    errorMessage: {
      type: String,
      required: true,
    },

    attemptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const assignSMSFail = mongoose.model(
  "SMSFailedAttempt",
  smsFailedAttemptSchema
);
