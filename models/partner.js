const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  partnerLogo: { type: String, required: true },
  partnerType: { type: String, required: true },
  description: { type: String },
  approved: { type: Boolean, default: false },
  address: { type: String },
});

const Partner = mongoose.model("Partner", partnerSchema);
module.exports = Partner;
