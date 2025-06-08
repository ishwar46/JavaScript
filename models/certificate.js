const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const mayorSchema = new Schema({
  mayorName: {
    type: String,
    required: true,
  },
  mayorSignature: {
    type: String,
    required: true,
  },
  deputyMayorName: {
    type: String,
    required: true,
  },
  deputyMayorSignature: {
    type: String,
    required: true,
  },
});

const certificateSchema = new mongoose.Schema(
  {
    mayorDetails: mayorSchema,
    certificateDetails: [
      {
        traineeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        traineeName: {
          type: String,
        },
        trainerName: {
          type: String,
        },
        trainingType: {
          type: String,
        },
        issueDate: {
          type: Date,
          default: Date.now,
        },
        certificateNumber: {
          type: String,
          unique: true,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
