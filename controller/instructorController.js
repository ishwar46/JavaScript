const Instructor = require("../models/instructor");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const handlebars = require("handlebars");
const upload = require("../middleware/multipledocs");
const { sendSMS } = require("../utils/smsSender");
const path = require("path");
const passwordResetRequest = require("../models/passwordResetRequest");
const { sendEmail } = require("../utils/nodeMailer");

// Function to generate random password
function generateRandomPassword(length = 6) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Function to create fallback HTML if template fails
function createFallbackEmailHTML(
  name,
  mobile,
  password,
  isPasswordReset = false
) {
  if (isPasswordReset) {
    return `
      <p>Hello ${name},</p>
      <p>Your password has been reset.</p>
      <p>Your new login credentials:</p>
      <p>Mobile Number: ${mobile}</p>
      <p>Password: ${password}</p>
      <p>Please keep these credentials secure.</p>
      <p>Thank you,<br>SEEP Mela Team</p>
    `;
  } else {
    return `
      <p>Welcome ${name} to SEEP Mela as an instructor!</p>
      <p>Your login credentials:</p>
      <p>Mobile Number: ${mobile}</p>
      <p>Password: ${password}</p>
      <p>Please keep these credentials secure.</p>
      <p>Thank you,<br>SEEP Mela Team</p>
    `;
  }
}

// Register an instructor (can be done by self)
const registerInstructor = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message:
              "File/Photo's size is too large. Maximum allowed size is 5 MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: "Error uploading image.",
          error: err.message,
        });
      }

      const {
        fullName,
        mobileNumber,
        email,
        address,
        qualification,
        title,
        expertise,
      } = req.body;

      // Validate required fields
      if (
        !fullName ||
        !mobileNumber ||
        !address ||
        !qualification ||
        !title ||
        !expertise
      ) {
        return res.status(400).json({
          success: false,
          message: "All required fields must be provided",
        });
      }

      // Check if instructor with this mobile number already exists
      const existingInstructor = await Instructor.findOne({ mobileNumber });
      if (existingInstructor) {
        return res.status(400).json({
          success: false,
          message: "An instructor with this mobile number already exists",
        });
      }

      // Check if instructor with this email already exists (if email is provided)
      if (email) {
        const emailExists = await Instructor.findOne({ email });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "An instructor with this email already exists",
          });
        }
      }

      // Generate a random password
      const randomPassword = generateRandomPassword(8);

      // Get profile image path if uploaded
      const profileImage = req.files?.profileImage
        ? req.files.profileImage[0].filename
        : null;
      const instructorSignature = req.files?.instructorSignature
        ? req.files.instructorSignature[0].filename
        : null;

      // Create new instructor
      const instructor = new Instructor({
        fullName,
        mobileNumber,
        email,
        address,
        qualification,
        title,
        expertise,

        password: randomPassword,
        plainTextPassword: randomPassword,
        profileImage,
        instructorSignature,
        createdBy: "self",
      });

      await instructor.save();

      // Read and compile the email template
      let emailHTML = "";
      try {
        const source = fs
          .readFileSync("instructortemplate.html", "utf-8")
          .toString();
        const template = handlebars.compile(source);
        const replacements = {
          fullName: instructor.fullName,
          mobileNumber: instructor.mobileNumber,
          password: randomPassword,
        };
        emailHTML = template(replacements);
      } catch (error) {
        console.error("Error compiling email template:", error);
        emailHTML = createFallbackEmailHTML(
          instructor.fullName,
          instructor.mobileNumber,
          randomPassword
        );
      }

      // Send welcome email if email is provided
      if (email) {
        try {
          await sendEmail({
            from: "SEEP Mela <tiu.kmc@gmail.com>",
            to: email,
            subject: "Welcome to SEEP Mela as Instructor",
            html: emailHTML,
          });
        } catch (error) {
          console.error("Error sending welcome email:", error);
        }
      }

      // Send welcome SMS to instructor's mobile number
      try {
        const smsMessage = `सीप मेला मा प्रशिक्षकको रूपमा स्वागत छ! तपाईंका लगइन विवरणहरू: मोबाइल: ${mobileNumber}, पासवर्ड: ${randomPassword}। कृपया यी सुरक्षित राख्नुहोस्। तपाईंको खाता प्रमाणीकरण प्रक्रिया मा छ, जसमा अधिकतम २४ घण्टा लाग्न सक्छ।`;

        // await sendSMS({
        //   mobile: mobileNumber,
        //   message: smsMessage,
        // });
      } catch (error) {
        console.error("Error sending welcome SMS:", error);
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: instructor._id, role: instructor.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Return success response
      return res.status(201).json({
        success: true,
        message: "Instructor registered successfully",
        instructor: {
          id: instructor._id,
          fullName: instructor.fullName,
          mobileNumber: instructor.mobileNumber,
          email: instructor.email,
          role: instructor.role,
          createdBy: instructor.createdBy,
        },
        token,
      });
    });
  } catch (error) {
    console.error("Error registering instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Login instructor
const loginInstructor = async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;

    // Validate required fields
    if (!mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and password are required",
      });
    }

    // Find instructor
    const instructor = await Instructor.findOne({ mobileNumber });
    if (!instructor) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number or password",
      });
    }

    // Check if instructor is active
    if (!instructor.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    // Verify password
    const isMatch = await instructor.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: instructor._id, role: instructor.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      instructor: {
        id: instructor._id,
        fullName: instructor.fullName,
        mobileNumber: instructor.mobileNumber,
        email: instructor.email,
        role: instructor.role,
      },
      token,
    });
  } catch (error) {
    console.error("Error logging in instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Admin create instructor
const adminCreateInstructor = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message:
              "File/Photo's size is too large. Maximum allowed size is 5 MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: "Error uploading image.",
          error: err.message,
        });
      }

      const {
        fullName,
        mobileNumber,
        email,
        address,
        qualification,
        title,
        expertise,
      } = req.body;

      // Validate required fields
      if (
        !fullName ||
        !mobileNumber ||
        !address ||
        !qualification ||
        !title ||
        !expertise
      ) {
        return res.status(400).json({
          success: false,
          message: "All required fields must be provided",
        });
      }

      // Check if instructor with this mobile number already exists
      const existingInstructor = await Instructor.findOne({ mobileNumber });
      if (existingInstructor) {
        return res.status(400).json({
          success: false,
          message: "An instructor with this mobile number already exists",
        });
      }

      // Check if instructor with this email already exists (if email is provided)
      if (email) {
        const emailExists = await Instructor.findOne({ email });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "An instructor with this email already exists",
          });
        }
      }

      // Generate a random password
      const randomPassword = generateRandomPassword(8);

      // Get profile image path if uploaded
      const profileImage = req.files?.profileImage
        ? req.files.profileImage[0].filename
        : null;
      const instructorSignature = req.files?.instructorSignature
        ? req.files.instructorSignature[0].filename
        : null;

      // Create new instructor
      const instructor = new Instructor({
        fullName,
        mobileNumber,
        email,
        address,
        qualification,
        title,
        expertise,

        password: randomPassword,
        plainTextPassword: randomPassword,
        profileImage,
        instructorSignature,
        createdBy: "admin",
        isActive: true,
      });

      await instructor.save();

      // Read and compile the email template
      let emailHTML = createFallbackEmailHTML(
        instructor.fullName,
        instructor.mobileNumber,
        randomPassword
      );

      // Send welcome email if email is provided
      if (email) {
        try {
          await sendEmail({
            from: "SEEP Mela <tiu.kmc@gmail.com>",
            to: email,
            subject: "Welcome to SEEP Mela as Instructor",
            html: emailHTML,
          });
        } catch (error) {
          console.error("Error sending welcome email:", error);
        }
      }

      // Send welcome SMS to instructor's mobile number
      try {
        const smsMessage = `सीप मेला मा प्रशिक्षकको रूपमा स्वागत छ! तपाईंका लगइन प्रमाणहरू: मोबाइल: ${mobileNumber}, पासवर्ड: ${randomPassword}। कृपया यी सुरक्षित राख्नुहोस्।`;
        // await sendSMS({
        //   mobile: mobileNumber,
        //   message: smsMessage,
        // });
      } catch (error) {
        console.error("Error sending welcome SMS:", error);
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: instructor._id, role: instructor.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // Return success response
      return res.status(201).json({
        success: true,
        message: "Instructor created successfully",
        instructor: {
          id: instructor._id,
          fullName: instructor.fullName,
          mobileNumber: instructor.mobileNumber,
          email: instructor.email,
          role: instructor.role,
          createdBy: instructor.createdBy,
        },
        token,
      });
    });
  } catch (error) {
    console.error("Error registering instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all instructors (admin only)

const getAllInstructors = async (req, res) => {
  try {
    const { search, expertise, page = 1, limit = 10 } = req.query;
    let filterQuery = { role: "instructor" };
    // Correctly filter by sectorOfInterest
    if (expertise && expertise !== "") {
      filterQuery.expertise = expertise;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filterQuery.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalUsers = await Instructor.countDocuments({ role: "instructor" });
    // Execute query with sorting first
    const instructors = await Instructor.find(filterQuery)
      .select("-password")
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      instructors,
      totalPages: Math.ceil(totalUsers / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users.",
    });
  }
};
// Get instructor by ID (admin only)
const getInstructorById = async (req, res) => {
  try {
    const { instructorId } = req.params;

    const instructor = await Instructor.findById(instructorId).select(
      "-password"
    );

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    return res.status(200).json({
      success: true,
      instructor,
    });
  } catch (error) {
    console.error("Error fetching instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update instructor (admin only)
const updateInstructor = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message:
              "File/Photo's size is too large. Maximum allowed size is 5 MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: "Error uploading image.",
          error: err.message,
        });
      }

      const { instructorId } = req.params;
      const {
        fullName,
        mobileNumber,
        email,
        address,
        qualification,
        title,
        expertise,
        isActive,
      } = req.body;

      const instructor = await Instructor.findById(instructorId);

      if (!instructor) {
        return res.status(404).json({
          success: false,
          message: "Instructor not found",
        });
      }

      // Check if mobile number is being changed and if it's already taken
      if (mobileNumber && mobileNumber !== instructor.mobileNumber) {
        const existingInstructor = await Instructor.findOne({ mobileNumber });
        if (
          existingInstructor &&
          existingInstructor._id.toString() !== instructorId
        ) {
          return res.status(400).json({
            success: false,
            message:
              "This mobile number is already registered to another instructor",
          });
        }
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== instructor.email) {
        const emailExists = await Instructor.findOne({ email });
        if (emailExists && emailExists._id.toString() !== instructorId) {
          return res.status(400).json({
            success: false,
            message: "This email is already registered to another instructor",
          });
        }
      }

      // Update instructor fields
      instructor.fullName = fullName || instructor.fullName;
      instructor.mobileNumber = mobileNumber || instructor.mobileNumber;
      instructor.email = email || instructor.email;
      instructor.address = address || instructor.address;
      instructor.qualification = qualification || instructor.qualification;
      instructor.title = title || instructor.title;
      instructor.expertise = expertise || instructor.expertise;

      // Update isActive status if provided
      if (isActive !== undefined) {
        instructor.isActive = isActive;
      }

      // Update profile image if provided
      if (req.files?.profileImage) {
        // Delete old image if exists
        if (instructor.profileImage) {
          try {
            fs.unlinkSync(
              `public/uploads/instructorimage/${instructor.profileImage}`
            );
          } catch (error) {
            console.error("Error deleting old profile image:", error);
          }
        }

        instructor.profileImage = req.files.profileImage[0].filename;
      }
      if (req.files?.instructorSignature) {
        // Delete old image if exists
        if (instructor.instructorSignature) {
          try {
            fs.unlinkSync(
              `public/uploads/instructorimage/${instructor.instructorSignature}`
            );
          } catch (error) {
            console.error("Error deleting old profile image:", error);
          }
        }

        instructor.instructorSignature =
          req.files.instructorSignature[0].filename;
      }

      await instructor.save();

      return res.status(200).json({
        success: true,
        message: "Instructor updated successfully",
        instructor: {
          id: instructor._id,
          fullName: instructor.fullName,
          mobileNumber: instructor.mobileNumber,
          email: instructor.email,
          address: instructor.address,
          qualification: instructor.qualification,
          title: instructor.title,
          expertise: instructor.expertise,
          isActive: instructor.isActive,
          profileImage: instructor.profileImage,
          instructorSignature: instructor.instructorSignature,
        },
      });
    });
  } catch (error) {
    console.error("Error updating instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
const updateInstructorStatus = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { isActive } = req.body;

    const instructor = await Instructor.findById(instructorId);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Update isActive status if provided
    if (isActive !== undefined) {
      instructor.isActive = isActive;
    }

    await instructor.save();

    return res.status(200).json({
      success: true,
      message: "Instructor Status Changed Successfully",
      instructor: {
        isActive: instructor.isActive,
      },
    });
  } catch (error) {
    console.error("Error updating instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required." });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    // Check if the token exists in the PasswordResetRequest collection
    const resetRequest = await passwordResetRequest.findOne({
      resetToken: token,
    });
    if (!resetRequest) {
      return res.status(400).json({
        error:
          "Invalid or expired token. Please request a new password reset link.",
      });
    }

    // Verify the token and extract the instructorId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const instructorId = decoded.instructorId;
    const instructor = await Instructor.findById(instructorId);
    if (!instructor) {
      return res.status(404).json({ error: "Instructor not found." });
    }

    // Hash the new password and update the instructor record
    instructor.password = await bcrypt.hash(newPassword, 10);
    instructor.plainTextPassword = newPassword; // Set plainTextPassword
    await instructor.save();

    // Remove the token so it cannot be reused
    await passwordResetRequest.deleteOne({ _id: resetRequest._id });

    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res
      .status(500)
      .json({ error: "Server error while resetting password." });
  }
};
// Delete instructor (admin only)
const deleteInstructor = async (req, res) => {
  try {
    const { instructorId } = req.params;

    const instructor = await Instructor.findById(instructorId);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Delete profile image if exists
    if (instructor.profileImage) {
      try {
        fs.unlinkSync(
          `public/uploads/instructorimage/${instructor.profileImage}`
        );
      } catch (error) {
        console.error("Error deleting profile image:", error);
      }
    }
    // Delete signature if exists
    if (instructor.instructorSignature) {
      try {
        fs.unlinkSync(
          `public/uploads/instructorimage/${instructor.instructorSignature}`
        );
      } catch (error) {
        console.error("Error deleting instructor signature:", error);
      }
    }

    await Instructor.findByIdAndDelete(instructorId);

    return res.status(200).json({
      success: true,
      message: "Instructor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting instructor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Reset instructor password (admin only)
const resetInstructorPassword = async (req, res) => {
  try {
    const { instructorId } = req.params;

    const instructor = await Instructor.findById(instructorId);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Generate a random password
    const randomPassword = generateRandomPassword(8);

    // Update password
    instructor.password = randomPassword;
    instructor.plainTextPassword = randomPassword;

    await instructor.save();

    // Send email with new password if email exists
    if (instructor.email) {
      // Read and compile the email template
      let emailHTML = "";
      try {
        const source = fs
          .readFileSync("password_reset.html", "utf-8")
          .toString();
        const template = handlebars.compile(source);
        const replacements = {
          fullName: instructor.fullName,
          mobileNumber: instructor.mobileNumber,
          password: randomPassword,
        };
        emailHTML = template(replacements);
      } catch (error) {
        console.error("Error compiling email template:", error);
        emailHTML = createFallbackEmailHTML(
          instructor.fullName,
          instructor.mobileNumber,
          randomPassword,
          true
        );
      }

      try {
        await sendEmail({
          from: "SEEP Mela <tiu.kmc@gmail.com>",
          to: instructor.email,
          subject: "Your Password Has Been Reset",
          html: emailHTML,
        });
      } catch (error) {
        console.error("Error sending password reset email:", error);
      }
    }

    // Send SMS with new password to instructor's mobile number
    try {
      const smsMessage = `Your SEEP Mela instructor password has been reset. New password: ${randomPassword}. Please keep this secure.`;
      await sendSMS({
        mobile: instructor.mobileNumber,
        message: smsMessage,
      });
    } catch (error) {
      console.error("Error sending password reset SMS:", error);
    }

    return res.status(200).json({
      success: true,
      message: "Instructor password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting instructor password:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get instructor profile (instructor only)
const getInstructorProfile = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const instructor = await Instructor.findById(instructorId).select(
      "-password"
    );

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    return res.status(200).json({
      success: true,
      instructor,
    });
  } catch (error) {
    console.error("Error fetching instructor profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
const forgotPassword = async (req, res) => {
  try {
    const { emailOrMobileNumber } = req.body;
    const instructor = await Instructor.findOne({
      $or: [
        { mobileNumber: emailOrMobileNumber },
        { email: emailOrMobileNumber },
      ],
    });
    if (!instructor) {
      return res.status(200).json({
        message:
          "If a instructor with that email or mobile number exists, a reset link has been sent.",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileNumberRegex = /^9[6-8]\d{8}$/;

    // Generate a reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      { instructorId: instructor._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );
    const resetLink = `https://kmc.seepmela.com/instructor-reset-password/${resetToken}`;

    const templatePath = path.join(
      __dirname,
      "../utils/forgotPasswordRequest.html"
    );
    let emailTemplate = fs.readFileSync(templatePath, "utf-8");

    emailTemplate = emailTemplate.replace("{{resetLink}}", resetLink);
    // Save the reset request in the database (fixed capitalization and undefined variable)
    const PasswordResetRequest = new passwordResetRequest({
      userId: instructor._id,
      email: emailOrMobileNumber, // Fixed: using the input value instead of undefined 'email'
      resetToken,
      emailSent: true,
    });

    // Fixed condition logic: if it IS a mobile number, send SMS
    if (mobileNumberRegex.test(emailOrMobileNumber)) {
      const smsText = `Use this link to reset your password ${resetLink}`;

      await sendSMS({
        to: emailOrMobileNumber,
        text: smsText,
      });
    }
    // If it IS an email, send email
    else if (emailRegex.test(emailOrMobileNumber)) {
      await sendEmail({
        from: "tiu.kmc@gmail.com",
        to: emailOrMobileNumber,
        subject: "Password Reset Request - SEEP Mela",
        html: emailTemplate,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number or email format",
      });
    }

    await PasswordResetRequest.save();

    return res.status(200).json({
      message:
        "If a instructor with that email or mobile number exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res
      .status(500)
      .json({ error: "Server error while processing request." });
  }
};
// Update instructor profile (instructor only)
const updateInstructorProfile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message:
              "File/Photo's size is too large. Maximum allowed size is 5 MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: "Error uploading image.",
          error: err.message,
        });
      }

      const instructorId = req.user.id;
      const { fullName, email, address, qualification, title, expertise } =
        req.body;

      const instructor = await Instructor.findById(instructorId);

      if (!instructor) {
        return res.status(404).json({
          success: false,
          message: "Instructor not found",
        });
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== instructor.email) {
        const emailExists = await Instructor.findOne({ email });
        if (emailExists && emailExists._id.toString() !== instructorId) {
          return res.status(400).json({
            success: false,
            message: "This email is already registered to another instructor",
          });
        }
      }

      // Update instructor fields
      instructor.fullName = fullName || instructor.fullName;
      instructor.email = email || instructor.email;
      instructor.address = address || instructor.address;
      instructor.qualification = qualification || instructor.qualification;
      instructor.title = title || instructor.title;
      instructor.expertise = expertise || instructor.expertise;

      // Update profile image if provided
      if (req.files?.profileImage) {
        // Delete old image if exists
        if (instructor.profileImage) {
          try {
            fs.unlinkSync(instructor.profileImage);
          } catch (error) {
            console.error("Error deleting old profile image:", error);
          }
        }

        instructor.profileImage = req.files.profileImage[0].filename;
      }

      await instructor.save();

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        instructor: {
          id: instructor._id,
          fullName: instructor.fullName,
          mobileNumber: instructor.mobileNumber,
          email: instructor.email,
          address: instructor.address,
          qualification: instructor.qualification,
          title: instructor.title,
          expertise: instructor.expertise,
          profileImage: instructor.profileImage,
        },
      });
    });
  } catch (error) {
    console.error("Error updating instructor profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Change instructor password (instructor only)
const changeInstructorPassword = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Find instructor
    const instructor = await Instructor.findById(instructorId);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Verify current password
    const isMatch = await instructor.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    instructor.password = newPassword;

    await instructor.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing instructor password:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Bulk delete instructors (admin only)
const deleteMultipleInstructors = async (req, res) => {
  try {
    const { instructorIds } = req.body;

    if (!Array.isArray(instructorIds) || !instructorIds.length) {
      return res
        .status(400)
        .json({ error: "Invalid or empty instructorIds array." });
    }

    const result = await Instructor.deleteMany({
      _id: { $in: instructorIds },
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} user(s) deleted.`,
    });
  } catch (error) {
    console.error("Delete error:", error.message);
    res.status(500).json({ error: "Server error." });
  }
};

module.exports = {
  registerInstructor,
  loginInstructor,
  adminCreateInstructor,
  getAllInstructors,
  getInstructorById,
  updateInstructor,
  deleteInstructor,
  resetInstructorPassword,
  getInstructorProfile,
  updateInstructorProfile,
  changeInstructorPassword,
  deleteMultipleInstructors,
  updateInstructorStatus,
  forgotPassword,
  resetPassword,
};
