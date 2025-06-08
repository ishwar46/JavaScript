const mongoose = require("mongoose");

const selectionMessageLogSchema = new mongoose.Schema({
  message: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  mobileNumber: {
    type: String,
  },
});

const SelectionMessageLog = mongoose.model(
  "SelectionMessageLog",
  selectionMessageLogSchema
);
module.exports = SelectionMessageLog;
