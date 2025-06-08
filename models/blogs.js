const mongoose = require("mongoose");

const blogItemSchema = new mongoose.Schema({
  enTitle: { type: String, required: true },
  enDescription: { type: String, default: "" },
  enFullContent: { type: String, default: "" },
  npTitle: { type: String, required: true },
  npDescription: { type: String, default: "" },
  npFullContent: { type: String, default: "" },
  Image: { type: String, default: "" },
  postedBy: { type: String, default: "" },
  postedAt: { type: Date, default: Date.now },
});

const blogPageSchema = new mongoose.Schema(
  {
    npPageTitle: { type: String, default: "Latest Blogs & News" },
    npPageSubtitle: { type: String, default: "" },
    enPageTitle: { type: String, default: "Latest Blogs & News" },
    enPageSubtitle: { type: String, default: "" },
    blogs: [blogItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlogPage", blogPageSchema);
