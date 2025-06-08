const mongoose = require("mongoose");

const MessageLogsSchema = new mongoose.Schema({
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

const MessageLog = mongoose.model("MessageLog", MessageLogsSchema);
module.exports = MessageLog;
