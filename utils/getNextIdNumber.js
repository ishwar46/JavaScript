const Counter = require("../models/counter");

async function getNextIdNumber() {
  const counter = await Counter.findOneAndUpdate(
    { id: "applicantId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return counter.seq;
}

module.exports = getNextIdNumber;
