const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../middleware/sendEmail");
const fs = require("fs");
const handlebars = require("handlebars");
const LiveStream = require("../models/liveStream");
const Volunteer = require("../models/volunteer");
const upload = require("../middleware/multipledocs");
const nodeMail = require("nodemailer");
const LoginLog = require("../models/loginlog");
const Coordinator = require("../models/coordinator");
const { sendSMS } = require("../utils/smsSender");
const generateStrongPassword = require("../utils/RandomPass");

const calculateMarks = (user) => {
  let totalMarks = 0;
  const breakdown = {};

  // Disability
  let disabilityMarks = 0;
  if (user?.disabilityStatus === "true" || user?.disabilityStatus === true) {
    if (user?.disabilityClass === "A") {
      disabilityMarks += 10;
    } else if (user?.disabilityClass === "B") {
      disabilityMarks += 8;
    } else if (user?.disabilityClass === "C") {
      disabilityMarks += 5;
    } else if (user?.disabilityClass === "D") {
      disabilityMarks += 3;
    }
    totalMarks += disabilityMarks;
    breakdown.disabilityStatus = {
      value: user?.disabilityClass + " Class",
      marks: disabilityMarks,
    };
  }
  // Illegal Vendor
  const businessMarks =
    user?.streetVendor === "true" || user?.streetVendor === true ? 10 : 0;
  totalMarks += businessMarks;
  breakdown.streetVendor = {
    value: user?.streetVendor,
    marks: businessMarks,
  };

  // Caste/Ethnicity
  let casteMarks = 0;
  const eth = user?.ethnicity?.toLowerCase();
  if (["brahmin", "chhetri", "other"].includes(eth)) {
    casteMarks = 0;
  } else {
    casteMarks = 10;
  }
  totalMarks += casteMarks;
  breakdown.ethnicity = { value: user?.ethnicity, marks: casteMarks };

  // Residency
  let residencyMarks = 0;

  if (user?.permanentMunicipality?.toLowerCase() === "kathmandu") {
    residencyMarks = 30;
    breakdown.residency = { value: "kathmandu", marks: residencyMarks };
  } else if (
    user?.isFromSpecialLocation === "true" ||
    user?.isFromSpecialLocation === true
  ) {
    residencyMarks = 25;
    breakdown.residency = { value: "landfill site", marks: residencyMarks };
  } else if (user?.permanentDistrict?.toLowerCase() === "kathmandu district") {
    residencyMarks = 15;
    breakdown.residency = { value: "p.d. kathmandu", marks: residencyMarks };
  } else if (user?.taxPayerStatus === "true" || user?.taxPayerStatus === true) {
    residencyMarks = 15;
    breakdown.residency = { value: "Tax Payer", marks: residencyMarks };
  } else if (user?.permanentProvince?.toLowerCase() === "bagmati province") {
    residencyMarks = 10;
    breakdown.residency = { value: "bagmati", marks: residencyMarks };
  } else {
    residencyMarks = 5;
    breakdown.residency = { value: "other", marks: residencyMarks };
  }
  totalMarks += residencyMarks;

  // Last year applicant
  const lastYearCondition =
    user?.registeredPrev === "true" || user?.registeredPrev === true;
  const notTrainedCondition =
    user?.alreadyTakenTraining === "false" ||
    user?.alreadyTakenTraining === false;
  const lastYearMarks = lastYearCondition && notTrainedCondition ? 40 : 0;
  totalMarks += lastYearMarks;
  breakdown.lastYearApplicant = {
    value: {
      registeredPrev: user?.registeredPrev,
      alreadyTakenTraining: user?.alreadyTakenTraining,
    },
    marks: lastYearMarks,
  };

  return {
    totalMarks,
    breakdown,
  };
};

// Admin registration controller
// Debugging example in adminRegister function
const adminRegister = async (req, res) => {
  const { emailAddress, userPassword } = req.body;

  try {
    // Check if admin with this email already exists
    const existingAdmin = await User.findOne({
      email: emailAddress,
      isAdmin: true,
    });

    if (existingAdmin) {
      return res
        .status(400)
        .json({ error: "Admin with this email already exists." });
    }

    // Hash password and create new admin
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    const admin = new User({
      email: emailAddress,
      password: hashedPassword,
      isAdmin: true,
      personalInformation: {
        fullName: {
          firstName: "Admin",
        },
      },
    });

    await admin.save();

    res.status(201).json({ message: "Admin registered successfully." });
  } catch (error) {
    console.error("Error during admin registration:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Admin resets the user's password
const adminResetPassword = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Generate a random password
    const randomPassword = generateStrongPassword(8);

    // Hash the password
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    try {
      const smsMessage = `तपाईंको सीप मेला खाताको पासवर्ड परिवर्तन गरिएको छ।
तपाईंका लगइन विवरणहरू:
मोबाइल नम्बर: दर्ता गरेको मोबाइल नम्बर 
पासवर्ड: ${randomPassword}
वेबसाइट: https://kmc.seepmela.com/login
कृपया यी विवरणहरू सुरक्षित राख्नुहोस्।
यदि तपाईंले यो परिवर्तन गर्नुभएको होइन भने, कृपया सपोर्टमा सम्पर्क गर्नुहोस्।

सेप मेला टीम`;

      await sendSMS({
        mobile: user.mobileNumber,
        message: smsMessage,
      });
    } catch (error) {
      console.error("Error sending welcome SMS:", error);
    }
    user.password = hashedPassword;
    user.loginAttempts = 0;
    user.isLocked = false;
    await user.save();
    res
      .status(200)
      .json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

//Admin Login
const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Extract client IP and user agent
    const ip =
      req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress;
    const cleanIp = ip.startsWith("::ffff:") ? ip.replace("::ffff:", "") : ip;
    const userAgent = req.headers["user-agent"];
    let isSuccess = false;

    // Find the admin by email
    const admin = await User.findOne({ email, isAdmin: true });
    if (!admin) {
      // Log failed attempt
      await LoginLog.create({ email, isSuccess, ip: cleanIp, userAgent });
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials." });
    }

    // Check if the password matches
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      // Log failed attempt
      await LoginLog.create({ email, isSuccess, ip: cleanIp, userAgent });
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials." });
    }

    // If successful login
    isSuccess = true;
    await LoginLog.create({
      userId: admin._id,
      email,
      isSuccess,
      ip: cleanIp,
      userAgent,
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, isAdmin: admin.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "1 day" }
    );

    // Respond with admin details and token
    res.status(200).json({
      token: token,
      admin: {
        id: admin._id,
        email: admin.email,
        isAdmin: admin.isAdmin,
      },
      success: true,
      message: "Admin login successful.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const transporter = nodeMail.createTransport({
  service: "gmail",
  auth: {
    user: "tiu.kmc@gmail.com",
    pass: "dlst hwgl gmie gbpt",
  },
});

const adminVerifyUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Assuming admin verification is successful and status is changed to "accepted"
    user.adminVerification.status = "accepted"; // Change the status to "accepted"
    user.isVerifiedByAdmin = true;
    await user.save();

    // Send the password only if the user is verified by admin and status is "accepted"
    // Check if the user is verified by admin and status is "accepted"
    if (
      user.isVerifiedByAdmin &&
      user.adminVerification.status === "accepted"
    ) {
      await user.save();

      const source = fs.readFileSync("mailtemplate.html", "utf-8").toString();
      const template = handlebars.compile(source);
      const replacements = {
        firstName: user.personalInformation.fullName.firstName,
        lastName: user.personalInformation.fullName.lastName,
        userUniqueID: userId,
      };

      const htmlToSend = template(replacements);
      const mailOptions = {
        from: "UranusTechNepal",
        to: user.personalInformation.emailAddress,
        subject:
          "Welcome to the Energy Transition for Resilient and Low Carbon Economy Summit 2025",
        html: htmlToSend,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          throw error;
        } else {
        }
      });
      res
        .status(200)
        .json({ success: true, message: "User verified successfully." });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
};

const verifyAdmin = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User is an admin.",
    });
  } catch (error) {
    console.error("Admin User Error:", error);
    return res.status(500).json({
      error: `Server error while getting user details: ${error.message}`,
    });
  }
};
const adminEditUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Find the user by ID and update
    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -__v");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "User updated successfully.", user });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
};

//delete user

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID and delete
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      fullName,
      gender,
      ethnicity,
      email,
      alternativeContact,
      citizenshipIssuedDistrict,
      disabilityStatus,
      taxPayerStatus,
      permanentProvince,
      permanentDistrict,
      permanentMunicipality,
      permanentWardNo,
      temporaryProvince,
      temporaryDistrict,
      temporaryMunicipality,
      temporaryWardNo,
      educationLevel,
      sectorOfInterest,
      registeredPrev,
      alreadyTakenTraining,
      dateOfBirth,
      age,
      isFromSpecialLocation,
      streetVendor,
    } = req.body;

    // Required field validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required for updating profile",
      });
    }

    if (age && age < 18) {
      return res.status(400).json({
        success: false,
        message: "Age should be greater than 18",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update allowed fields
    user.fullName = fullName ?? user.fullName;
    user.gender = gender ?? user.gender;
    user.ethnicity = ethnicity ?? user.ethnicity;
    user.alternativeContact = alternativeContact ?? user.alternativeContact;
    user.email = email ?? user.email;
    user.citizenshipIssuedDistrict =
      citizenshipIssuedDistrict ?? user.citizenshipIssuedDistrict;
    user.taxPayerStatus = taxPayerStatus ?? user.taxPayerStatus;
    user.dateOfBirth = dateOfBirth ?? user.dateOfBirth;
    user.age = age ?? user.age;
    user.citizenshipIssuedDistrict =
      citizenshipIssuedDistrict ?? user.citizenshipIssuedDistrict;
    user.disabilityStatus = disabilityStatus ?? user.disabilityStatus;
    user.permanentProvince = permanentProvince ?? user.permanentProvince;
    user.permanentDistrict = permanentDistrict ?? user.permanentDistrict;
    user.permanentMunicipality =
      permanentMunicipality ?? user.permanentMunicipality;
    user.permanentWardNo = permanentWardNo ?? user.permanentWardNo;
    user.temporaryProvince = temporaryProvince ?? user.temporaryProvince;
    user.temporaryDistrict = temporaryDistrict ?? user.temporaryDistrict;
    user.temporaryMunicipality =
      temporaryMunicipality ?? user.temporaryMunicipality;
    user.temporaryWardNo = temporaryWardNo ?? user.temporaryWardNo;
    user.educationLevel = educationLevel ?? user.educationLevel;
    user.sectorOfInterest = sectorOfInterest ?? user.sectorOfInterest;
    user.registeredPrev = registeredPrev ?? user.registeredPrev;
    user.alreadyTakenTraining =
      alreadyTakenTraining ?? user.alreadyTakenTraining;
    user.isFromSpecialLocation =
      isFromSpecialLocation ?? user.isFromSpecialLocation;
    user.streetVendor = streetVendor ?? user.streetVendor;
    // Recalculate marks
    const { totalMarks, breakdown } = calculateMarks(req.body);
    user.marksObtained = totalMarks;
    user.marksBreakdown = breakdown;
    user.totalMarks = totalMarks + user.interviewMarks;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      user: user.toObject(),
    });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
const deleteMultipleUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds.userIds) || !userIds.userIds.length) {
      return res.status(400).json({ error: "Invalid or empty userIds array." });
    }

    const result = await User.deleteMany({ _id: { $in: userIds.userIds } });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} user(s) deleted.`,
    });
  } catch (error) {
    console.error("Delete error:", error.message);
    res.status(500).json({ error: "Server error." });
  }
};

const updateConferenceKitStatus = async (req, res) => {
  const { userId } = req.params;
  const { received } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.conferenceKitReceived = received;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Conference kit status updated." });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
};

// Admin posts live stream URL
const postLiveStreamUrl = async (req, res) => {
  try {
    const { url } = req.body;

    // Validate the URL to allow both youtube.com and youtu.be
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!url || !youtubeRegex.test(url)) {
      return res
        .status(400)
        .json({ success: false, error: "Please provide a valid YouTube URL." });
    }

    // Save the URL
    const liveStream = new LiveStream({ url });
    await liveStream.save();

    res.status(201).json({
      success: true,
      message: "Live stream URL successfully saved.",
      liveStream,
    });
  } catch (error) {
    console.error("Error posting live stream URL:", error);

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while saving the live stream URL.",
    });
  }
};

// Get the live stream URL
const getLiveStreamUrl = async (req, res) => {
  try {
    const liveStream = await LiveStream.findOne()
      .sort({ createdAt: -1 })
      .limit(1); // Get the latest link

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        error: "No live stream URL found.",
      });
    }

    res.status(200).json({
      success: true,
      liveStream,
    });
  } catch (error) {
    console.error("Error getting live stream URL:", error);

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while fetching the live stream URL.",
    });
  }
};

// Fetch all users with email and institution
const adminGetCheckInList = async (req, res) => {
  try {
    const users = await User.find(
      {},
      "personalInformation.emailAddress personalInformation.nameOfInstitution arrivalCheckIn"
    );
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
};

// Mark check-in
const adminCheckInUser = async (req, res) => {
  const { userId } = req.params;
  const { participantCheckIn, accompanyCheckIn } = req.body;

  try {
    // Fetch the user from the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Ensure arrivalCheckIn is initialized
    if (!user.personalInformation.arrivalCheckIn) {
      user.personalInformation.arrivalCheckIn = {
        participantCheckIn: {},
        accompanyCheckIn: {},
      };
    }

    // Handle participant check-in
    if (participantCheckIn) {
      user.personalInformation.arrivalCheckIn.participantCheckIn.checkedIn = true;
      user.personalInformation.arrivalCheckIn.participantCheckIn.date =
        new Date();
      user.markModified(
        "personalInformation.arrivalCheckIn.participantCheckIn"
      );
    }

    // Handle accompanying person check-in, but only if user has an accompanying person
    if (accompanyCheckIn) {
      if (
        user.accompanyingPerson &&
        user.accompanyingPerson.hasAccompanyingPerson
      ) {
        user.personalInformation.arrivalCheckIn.accompanyCheckIn.checkedIn = true;
        user.personalInformation.arrivalCheckIn.accompanyCheckIn.date =
          new Date();
        user.markModified(
          "personalInformation.arrivalCheckIn.accompanyCheckIn"
        );
      } else {
        // Skip the accompanying check-in if the user has no accompanying person, but continue with the participant check-in
        // console.log(
        //   `User ${userId} does not have an accompanying person, skipping accompany check-in.`
        // );
      }
    }

    // Save the updated user data
    await user.save();

    res.status(200).json({ success: true, message: "Check-in updated" });
  } catch (error) {
    console.error("Error updating check-in:", error);
    res.status(500).json({ error: "Error updating check-in" });
  }
};

// Caching the email template in memory
let templateSource = fs
  .readFileSync("volunteertemplate.html", "utf-8")
  .toString();
const emailTemplateForVol = handlebars.compile(templateSource);

const createVolunteer = async (req, res) => {
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

      const { fullName, address, email, contact } = req.body;

      if (!fullName || !address || !email || !contact) {
        return res.status(400).json({
          success: false,
          message: "All fields are required.",
        });
      }

      const volunteerImage = req.files?.volunteerimage
        ? req.files.volunteerimage[0].path
        : null;

      const emailExist = await Volunteer.findOne({ email });
      if (emailExist) {
        return res.status(400).json({
          success: false,
          message: "Email already exists.",
        });
      }

      const randomPassword = generateStrongPassword(8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUser = new Volunteer({
        fullName,
        address,
        contact,
        email,
        password: hashedPassword,
        volunteerimage: volunteerImage,
        isVolunteer: true,
      });

      await newUser.save();

      const htmlToSend = emailTemplateForVol({
        email: newUser.email,
        password: randomPassword,
      });

      const mailOptions = {
        from: "SEEP MELA <tiu.kmc@gmail.com>",
        to: newUser.email,
        subject: "Welcome to SEEP MELA 2082",
        html: htmlToSend,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error.message);
          return res.status(500).json({
            success: false,
            message:
              "Volunteer registered, but failed to send confirmation email.",
            error: error.message,
          });
        } else {
          return res.status(200).json({
            success: true,
            message:
              "Volunteer registered successfully. Confirmation email sent.",
          });
        }
      });
    });
  } catch (error) {
    console.error("Error while creating volunteer:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

const getAllVolunteer = async (req, res) => {
  try {
    const allVolunteer = await Volunteer.find();
    if (!allVolunteer || allVolunteer.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Volunteer Users Found",
      });
    }
    return res.status(200).json({
      success: true,
      allVolunteer,
      message: "All Volunteers Fetched Successfully",
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};

const deleteVolunteerById = async (req, res) => {
  try {
    const volunteer = await Volunteer.findByIdAndDelete(req.params.id);
    if (!volunteer) {
      return res.status(400).json({
        success: false,
        message: "Provider Volunteer ID Not Found in DB",
      });
    }

    return res.status(200).json({
      success: true,
      volunteer,
      message: "Volunteer Deleted Successfully",
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};

const updateVolunteerById = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).send({
            success: false,
            message:
              "File/Photo's size is too large. Maximum allowed size is 5 MB.",
          });
        }
        return res.status(400).send({
          success: false,
          message: "Error uploading image.",
          error: err.message,
        });
      }

      const { fullName, address, email, contact } = req.body;

      const volunteer = await Volunteer.findById(req.params.id);
      if (!volunteer) {
        return res.status(404).json({
          success: false,
          message: "Volunteer not found",
        });
      }

      volunteer.fullName = fullName || volunteer.fullName;
      volunteer.address = address || volunteer.address;
      volunteer.email = email || volunteer.email;
      volunteer.contact = contact || volunteer.contact;
      volunteer.volunteerimage = req.files?.volunteerimage
        ? req.files.volunteerimage[0].path
        : volunteer.volunteerimage;

      await volunteer.save();

      return res.status(200).json({
        success: true,
        volunteer,
        message: "Volunteer updated successfully",
      });
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};
const createCoordinator = async (req, res) => {
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

      const { fullName, address, contact, email, field } = req.body;

      if (!fullName || !address || !contact) {
        return res.status(400).json({
          success: false,
          message: "All fields are required.",
        });
      }

      const coordinatorImage = req.files?.coordinatorImage
        ? req.files.coordinatorImage[0].path
        : null;

      const randomPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUser = new Coordinator({
        fullName,
        address,
        contact,
        email,
        field,
        password: hashedPassword,
        coordinatorImage,
      });

      await newUser.save();

      // Send welcome SMS to instructor's mobile number
      try {
        const smsMessage = `सीप मेला २०८२ मा ${field} संयोजकको रूपमा तपाईंलाई स्वागत छ।
तपाईंका लगइन विवरणहरू:
मोबाइल नम्बर: ${contact}
पासवर्ड: ${randomPassword}
वेबसाइट: https://kmc.seepmela.com/coordinator-login
कृपया यी विवरणहरू सुरक्षित राख्नुहोस्।`;
        await sendSMS({
          mobile: contact,
          message: smsMessage,
        });
      } catch (error) {
        console.error("Error sending welcome SMS:", error);
      }
      return res.status(200).json({
        success: true,
        message: "Coordinator Added Successfully",
      });
    });
  } catch (error) {
    console.error("Error while creating coordinator:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

const getAllCoordinators = async (req, res) => {
  try {
    const allCoordinator = await Coordinator.find();
    if (!allCoordinator || allCoordinator.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No Coordinator Users Found",
      });
    }
    return res.status(200).json({
      success: true,
      allCoordinator,
      message: "All Coordinators Fetched Successfully",
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};
const deleteCoordinatorById = async (req, res) => {
  try {
    const coordinator = await Coordinator.findByIdAndDelete(req.params.id);
    if (!coordinator) {
      return res.status(400).json({
        success: false,
        message: "Provider coordinator ID Not Found in DB",
      });
    }

    return res.status(200).json({
      success: true,
      coordinator,
      message: "Coordinator Deleted Successfully",
    });
  } catch (error) {
    // console.log(error);
    return res.status(500).send("Internal Server Error");
  }
};
const updateCoordinatorById = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).send({
            success: false,
            message:
              "File/Photo's size is too large. Maximum allowed size is 5 MB.",
          });
        }
        return res.status(400).send({
          success: false,
          message: "Error uploading image.",
          error: err.message,
        });
      }

      const { fullName, address, email, contact, field } = req.body;

      const coordinator = await Coordinator.findById(req.params.id);
      if (!coordinator) {
        return res.status(404).json({
          success: false,
          message: "Coordinator not found",
        });
      }

      coordinator.fullName = fullName || coordinator.fullName;
      coordinator.address = address || coordinator.address;
      coordinator.email = email || coordinator.email;
      coordinator.contact = contact || coordinator.contact;
      coordinator.field = field || coordinator.field;
      coordinator.coordinatorImage = req.files?.coordinatorImage
        ? req.files.coordinatorImage[0].path
        : coordinator.coordinatorImage;

      await coordinator.save();

      return res.status(200).json({
        success: true,
        coordinator,
        message: "Coordinator updated successfully",
      });
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};
// careerCounsel check-in functions
const checkInForEvent = async (req, res) => {
  try {
    const { applicantId, eventType } = req.body;
    // console.log(req.body);
    if (!applicantId || !eventType) {
      return res.status(400).json({
        success: false,
        message: "Applicant ID and event type are required.",
      });
    }

    // Valid event types and their corresponding user schema fields
    const validEvents = {
      courseCounsel: "courseCounselAttendance",
      careerCounsel: "careerCounselAttendance",
      orientation: "orientationAttendance",
      entrepreneur: "entrepreneurAttendance",
      class: "classAttendance",
    };

    const attendanceField = validEvents[eventType];

    if (!attendanceField) {
      return res.status(400).json({
        success: false,
        message: "Invalid event type provided.",
      });
    }

    const user = await User.findOne({ applicantId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with the provided Applicant ID.",
      });
    }

    // Check if the user has already been checked in for this event
    const attendance = user[attendanceField];

    if (attendance?.attended) {
      const userDetails = {
        fullName: user.fullName,
        mobileNumber: user.mobileNumber,
        sectorOfInterest: user.sectorOfInterest,
        checkedInAt: attendance.checkedInAt,
        checkedInBy: attendance.checkedInBy?.role || "unknown",
      };

      return res.status(400).json({
        success: false,
        message: `This user has already been checked in for the ${eventType} event.`,
        userDetails,
        alreadyCheckedIn: true,
      });
    }

    // Record attendance
    user[attendanceField] = {
      attended: true,
      checkedInAt: new Date(),
      checkedInBy: {
        id: req.user.id,
        role: req.user.isVolunteer ? "volunteer" : "admin",
      },
    };

    await user.save();

    const userDetails = {
      fullName: user.fullName,
      mobileNumber: user.mobileNumber,
      sectorOfInterest: user.sectorOfInterest,
    };

    return res.status(200).json({
      success: true,
      message: `User checked in for the ${eventType} event successfully.`,
      userDetails,
    });
  } catch (error) {
    console.error(
      `Error during check-in for ${req.body?.eventType || "event"}:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

const getEventAttendance = async (req, res) => {
  try {
    const eventType = req.query.eventType || "orientation"; // Default to orientation
    const sectorOfInterest = req.query.sectorOfInterest || ""; // Default to orientation
    const attendanceField = `${eventType}Attendance`;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0;
    const skip = (page - 1) * limit;

    // Base query
    const query = {};
    query[`${attendanceField}.attended`] = true;
    if (sectorOfInterest && sectorOfInterest !== "") {
      query.sectorOfInterest = sectorOfInterest;
    }

    // Search functionality
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      query.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { citizenshipNumber: searchRegex },
        { applicantId: searchRegex },
      ];
    }

    // Date filtering
    if (req.query.startDate || req.query.endDate) {
      query[`${attendanceField}.checkedInAt`] = {};

      if (req.query.startDate) {
        query[`${attendanceField}.checkedInAt`].$gte = new Date(
          req.query.startDate
        );
      }

      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        query[`${attendanceField}.checkedInAt`].$lte = endDate;
      }
    }

    // Sorting
    const sortField = req.query.sortBy || `${attendanceField}.checkedInAt`;
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    // Fetch paginated attendees
    const attendees = await User.find(
      query,
      `fullName mobileNumber sectorOfInterest applicantId ${attendanceField}`
    )
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendees = await User.countDocuments({
      [`${attendanceField}.attended`]: true,
      [`${attendanceField}.checkedInAt`]: { $gte: today, $lt: tomorrow },
    });

    const adminCheckins = await User.countDocuments({
      [`${attendanceField}.attended`]: true,
      [`${attendanceField}.checkedInBy.role`]: "admin",
    });

    const volunteerCheckins = await User.countDocuments({
      [`${attendanceField}.attended`]: true,
      [`${attendanceField}.checkedInBy.role`]: "volunteer",
    });

    const stats = {
      totalAttendees: total || 0,
      todayAttendees: todayAttendees || 0,
      adminCheckins: adminCheckins || 0,
      volunteerCheckins: volunteerCheckins || 0,
    };

    return res.status(200).json({
      success: true,
      count: total,
      attendees,
      stats,
    });
  } catch (error) {
    console.error(
      `Error fetching ${req.query.eventType || "orientation"} attendance:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  adminRegister,
  adminLogin,
  adminVerifyUser,
  deleteUser,
  adminEditUser,
  adminResetPassword,
  updateConferenceKitStatus,
  getLiveStreamUrl,
  postLiveStreamUrl,
  adminCheckInUser,
  adminGetCheckInList,
  createVolunteer,
  getAllVolunteer,
  deleteVolunteerById,
  updateVolunteerById,
  verifyAdmin,
  deleteMultipleUsers,
  updateUserProfile,
  createCoordinator,
  deleteCoordinatorById,
  updateCoordinatorById,
  getAllCoordinators,
  checkInForEvent,
  getEventAttendance,
};
