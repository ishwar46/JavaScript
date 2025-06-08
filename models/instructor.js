const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const instructorSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    qualification: {
      type: String,
      required: [true, "Highest qualification is required"],
      trim: true,
    },
    expertise: {
      type: String,
      required: [true, "Expertise is required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    plainTextPassword: {
      type: String,
      select: false,
    },
    profileImage: {
      type: String,
    },
    instructorSignature: {
      type: String,
    },
    role: {
      type: String,
      default: "instructor",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      enum: ["self", "admin"],
      default: "self",
    },
  },
  { timestamps: true }
);

// Pre-save hook to hash the password
instructorSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt);
    // Don't save plainTextPassword if it exists (additional security)
    if (this.plainTextPassword) {
      // We keep this temporarily for email, but don't save it to the database
      this.set("plainTextPassword", this.plainTextPassword, { skip: true });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password validity
instructorSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Instructor = mongoose.model("Instructor", instructorSchema);

module.exports = Instructor;
