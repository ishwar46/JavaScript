const mongoose = require("mongoose");

const heroSectionSchema = new mongoose.Schema({
  dateRange: {
    type: String,
  },
  title: {
    type: String,
  },
  slogan: {
    type: String,
  },
  eventDuration: {
    type: String,
  },
  location: {
    type: String,
  },
  participants: {
    type: Number,
    min: 0,
  },
  visitors: {
    type: Number,
    min: 0,
  },
  registerNow: {
    type: String,
  },
  viewSchedule: {
    type: String,
  },
  ImageArray: [{
    type: String,
  }],
});

module.exports = mongoose.model("HeroSection", heroSectionSchema);