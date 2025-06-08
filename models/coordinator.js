const mongoose = require("mongoose");

const coordinatorSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  address: {
    type: String,
  },
  contact: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  field: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  isCoordinator: {
    type: Boolean,
    default: true,
  },
  coordinatorImage: {
    type: String,
    required: false,
  },
});

const Coordinator = mongoose.model("Coordinator", coordinatorSchema);
module.exports = Coordinator;
