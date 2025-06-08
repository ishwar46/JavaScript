const Shortlist = require("../models/shortlistDetails");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const upload = require("../middleware/multipledocs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const createUploader = require("../middleware/uploader");
const generateRandomKey = require("../utils/RandomPass");
const { OTPGenerationEmail } = require("../emailTemplates/OTPGenerationEmail");
const { sendEmail } = require("../utils/nodeMailer");
const { getAgeFromBsDate } = require("../utils/ageCalculator");
const generateStrongPassword = require("../utils/RandomPass");
const { sendSMS } = require("../utils/smsSender");
const RegNotification = require("../models/regNotification");
const passwordResetRequest = require("../models/passwordResetRequest");
const LoginLog = require("../models/loginlog");
const getNextIdNumber = require("../utils/getNextIdNumber");
const { welcomeEmail } = require("../emailTemplates/welcomeEmail");
const {
  selectionEmail,
  shortListEmail,
} = require("../emailTemplates/AccountStatusEmail");

const certificate = require("../models/certificate");
const MessageLog = require("../models/messageLogs");
const Coordinator = require("../models/coordinator");
const SelectionMessageLog = require("../models/selectionMessageLogs");

// Document uploader middleware
const fileUploader = createUploader("files").fields([
  { name: "citizenshipFront", maxCount: 1 },
  { name: "profilePicture", maxCount: 1 },
  { name: "citizenshipBack", maxCount: 1 },
  { name: "disabilityEvidence", maxCount: 1 },
]);

const uploadFileMiddleware = (req, res, next) => {
  fileUploader(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

const MAX_LOGIN_ATTEMPTS = 5;

/**
 * User registration controller
 *
 */
const translateCitizenship = (citizenshipNumber) => {
  const digitMap = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
  };
  let y = "";
  for (let char of citizenshipNumber) {
    if (char === " ") continue;
    y += digitMap[char] ?? char;
  }
  return y;
};
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

const userInitialRegistration = async (req, res) => {
  try {
    const {
      fullName,
      gender,
      ethnicity,
      dateOfBirth,
      age,
      mobileNumber,
      alternativeContact,
      email,
      taxPayerStatus,
      streetVendor,
      citizenshipNumber,
      citizenshipIssuedDistrict,
      disabilityStatus,
      appliedBeforeSeepMela,
      isFromSpecialLocation,
      permanentProvince,
      permanentDistrict,
      permanentMunicipality,
      permanentWardNo,
      sameAsPermanent,
      temporaryProvince,
      temporaryDistrict,
      temporaryMunicipality,
      temporaryWardNo,
      educationLevel,
      sectorOfInterest,
      registeredPrev,
      alreadyTakenTraining,
      disabilityClass,
      taxPayerNumber,
      selectedOccupations,
      landfillSiteResident,
    } = req.body;

    // Validate required fields
    if (
      !mobileNumber ||
      !fullName ||
      !citizenshipNumber ||
      !registeredPrev ||
      !alreadyTakenTraining ||
      !permanentMunicipality ||
      age === "undefined" ||
      age === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: mobileNumber, fullName, citizenshipNumber, registeredPrev, alreadyTakenTraining, age, address",
      });
    }

    if (age < 18 || age > 58) {
      return res.status(400).json({
        success: false,
        message: "Age should be between 18 and 58",
      });
    }

    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileNumberRegex = /^9[6-8]\d{8}$/;

    if (!mobileNumberRegex.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    let { totalMarks, breakdown } = calculateMarks(req.body);

    const hasEnglish = /[0-9]/.test(citizenshipNumber);
    const hasNepali = /[०-९]/.test(citizenshipNumber);

    if (hasEnglish && hasNepali) {
      return res.status(400).json({
        success: false,
        message: "Error Invalid Citizenship Number",
      });
    }
    let newCitizenshipNumber = citizenshipNumber.replace(/\s+/g, "");
    if (hasNepali) {
      newCitizenshipNumber = translateCitizenship(citizenshipNumber);
    }
    // Check for existing user
    let existingUser;
    if (email) {
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }

      existingUser = await User.findOne({
        $or: [
          { email },
          { mobileNumber },
          { citizenshipNumber: newCitizenshipNumber },
        ],
      });
    } else {
      existingUser = await User.findOne({
        $or: [{ mobileNumber }, { citizenshipNumber: newCitizenshipNumber }],
      });
    }
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          "User is already registered with this email address, citizenship or mobile number",
      });
    }

    const password = generateStrongPassword(8);
    const hashedPassword = await bcrypt.hash(password, 10);
    const Counter = (await getNextIdNumber()).toString().padStart(4, "0");

    const applicantId = "KMC" + Counter;
    // Create new user with all the fields from formData
    const newUser = new User({
      fullName,
      applicantId,
      marksObtained: totalMarks,
      totalMarks: totalMarks,
      marksBreakdown: breakdown,
      password: hashedPassword,
      gender,
      taxPayerStatus,
      ethnicity,
      dateOfBirth,
      age,
      mobileNumber,
      alternativeContact,
      email,
      citizenshipNumber: newCitizenshipNumber,
      citizenshipIssuedDistrict,
      disabilityStatus:
        disabilityStatus === "true" || disabilityStatus === true,
      appliedBeforeSeepMela:
        appliedBeforeSeepMela === "true" || appliedBeforeSeepMela === true,
      isFromSpecialLocation:
        isFromSpecialLocation === "true" || isFromSpecialLocation === true,
      permanentProvince,
      permanentDistrict,
      permanentMunicipality,
      permanentWardNo,
      sameAsPermanent: sameAsPermanent === "true" || sameAsPermanent === true,
      streetVendor: streetVendor === "true" || streetVendor === true,
      temporaryProvince,
      temporaryDistrict,
      temporaryMunicipality,
      temporaryWardNo,
      educationLevel,
      sectorOfInterest,
      registeredPrev: registeredPrev === "true" || registeredPrev === true,
      alreadyTakenTraining:
        alreadyTakenTraining === "true" || alreadyTakenTraining === true,
      disabilityClass,
      taxPayerNumber,
      selectedOccupations,
      landfillSiteResident,
    });

    await newUser.save();

    // Create registration notification with explicit type field
    const regNote = await RegNotification.create({
      message: `New registration – ${newUser.fullName}`,
      registrant: newUser._id,
      type: "registration", // Explicitly set the type field
      readBy: [],
    });

    // Log notification creation
    // console.log(
    //   `Registration notification created: ${regNote._id} for user ${newUser.fullName}`
    // );

    // Emit notification to admin room with proper structure
    if (req.io) {
      const notificationData = {
        _id: regNote._id,
        message: regNote.message,
        timestamp: regNote.createdAt,
        type: "registration",
        registrant: {
          _id: newUser._id,
          fullName: newUser.fullName,
          profilePicture: newUser.profilePicture || null,
        },
        readBy: [],
      };

      // Debug log before emitting

      // Only emit to admins room
      req.io.to("admins").emit("receiveRegNotification", notificationData);

      // Log after emitting
    } else {
      console.warn("Socket (req.io) not available - notification not emitted");
    }

    // Send SMS confirmation
    //     const smsText = `धन्यवाद!
    // तपाईंको तालिम आवेदन फारम सफलतापूर्वक दर्ता भएको छ। थप जानकारीको लागि तपाईंलाई पुन: म्यासेज आउनेछ।
    // आवेदक आइडी: ${applicantId}
    // कृपया आफ्नो आवेदक आइडी सुरक्षित राख्नु होला।
    // सीप मेला २०८२,
    // का.म.पा.`;
    //     await sendSMS({ mobile: mobileNumber, message: smsText });
    //     if (email) {
    //       await sendEmail({
    //         from: "tiu.kmc@gmail.com",
    //         to: email,
    //         subject: "Welcome To SeepMela",
    //         html: welcomeEmail(email, fullName),
    //       });
    //     }
    const userResponse = newUser.toObject();

    await newUser.save();
    const newMessageLog = new MessageLog({
      message: applicantId,
      mobileNumber: mobileNumber,
    });
    await newMessageLog.save();
    return res.status(201).json({
      success: true,
      message: "Registration successful!",
    });
  } catch (error) {
    console.error("Registration Error:", error);
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
    const user = await User.findOne({
      $or: [
        { mobileNumber: emailOrMobileNumber },
        { email: emailOrMobileNumber },
      ],
    });
    if (!user || !user.adminVerification.accountStatus === "selected") {
      return res.status(200).json({
        message:
          "If a user with that email or mobile number exists, a reset link has been sent.",
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileNumberRegex = /^9[6-8]\d{8}$/;

    // Generate a reset token (expires in 1 hour)
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const resetLink = `https://kmc.seepmela.com/reset-password/${resetToken}`;

    const templatePath = path.join(
      __dirname,
      "../utils/forgotPasswordRequest.html"
    );
    let emailTemplate = fs.readFileSync(templatePath, "utf-8");

    emailTemplate = emailTemplate.replace("{{resetLink}}", resetLink);
    // Save the reset request in the database (fixed capitalization and undefined variable)
    const PasswordResetRequest = new passwordResetRequest({
      userId: user._id,
      email: emailOrMobileNumber, // Fixed: using the input value instead of undefined 'email'
      resetToken,
      emailSent: true,
    });

    // Fixed condition logic: if it IS a mobile number, send SMS
    if (mobileNumberRegex.test(emailOrMobileNumber)) {
      const smsMessage = `Use this link to reset your password ${resetLink}`;
      await sendSMS({
        mobile: emailOrMobileNumber,
        message: smsMessage,
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
        "If a user with that email or mobile number exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res
      .status(500)
      .json({ error: "Server error while processing request." });
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

    // Verify the token and extract the userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Hash the new password and update the user record
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

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
const deleteImage = async (req, res) => {
  try {
    const { id, fieldName } = req.query;

    if (!id || !fieldName) {
      return res
        .status(400)
        .json({ message: "User ID and field name are required" });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Document field names from the frontend
    const validFieldNames = [
      "profilePicture",
      "disabilityEvidence",
      "landfillEvidence",
      "taxPayerEvidence",
      "citizenshipFront",
      "citizenshipBack",
      "proofOfTaxPayment",
      "temporaryAddressRecommendationLetter",
    ];

    // Check if the field name includes "otherDocuments_"
    const isOtherDocument = fieldName.startsWith("otherDocuments_");
    const isValidField = validFieldNames.includes(fieldName) || isOtherDocument;

    if (!isValidField) {
      return res.status(400).json({ message: "Invalid field name" });
    }

    // Handle regular document fields
    if (!isOtherDocument) {
      if (!user.documents || !user.documents[fieldName]) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Get the file path
      const filePath = user.documents[fieldName];

      // Remove the document from the user's documents
      user.documents[fieldName] = "";
      await user.save();

      // Delete the file from storage (optional - implement file deletion logic here)
      // For example: fs.unlinkSync(path.join(__dirname, '../uploads/files/', filePath));

      return res.status(200).json({ message: "Document deleted successfully" });
    }
    // Handle otherDocuments array
    else {
      if (!user.documents || !user.documents.otherDocuments) {
        return res.status(404).json({ message: "Other documents not found" });
      }

      // Extract index from fieldName (e.g., "otherDocuments_1" → 1)
      const index = parseInt(fieldName.split("_")[1], 10);

      if (
        isNaN(index) ||
        index < 0 ||
        index >= user.documents.otherDocuments.length
      ) {
        return res.status(400).json({ message: "Invalid document index" });
      }

      // Get the file path
      const filePath = user.documents.otherDocuments[index];

      // Remove the document from the array
      user.documents.otherDocuments.splice(index, 1);
      await user.save();

      // Delete the file from storage (optional - implement file deletion logic here)
      // For example: fs.unlinkSync(path.join(__dirname, '../uploads/files/', filePath));

      return res.status(200).json({ message: "Document deleted successfully" });
    }
  } catch (error) {
    console.error("Error deleting document:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * User kyc controller
 * Handles kyc with file uploads for profile image and documents
 */

const userRegister = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      // Fields from the simplified frontend
      targetCountry,
      trainingDetails,
    } = req.body;

    // Find the user by ID
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Store current file values
    let profilePicture = existingUser.profilePicture;
    let citizenshipFront = existingUser.citizenshipFront;
    let citizenshipBack = existingUser.citizenshipBack;
    let disabilityEvidence = existingUser.disabilityEvidence;

    // Keep track of files to delete
    const filesToDelete = [];

    // Function to delete file - with proper error handling
    const deleteFile = (filePath) => {
      try {
        // Check if file exists
        if (fs.existsSync(filePath)) {
          // Delete the file
          fs.unlinkSync(filePath);

          return true;
        }
        return false;
      } catch (err) {
        console.error(`Error deleting file ${filePath}: ${err.message}`);
        return false;
      }
    };

    // Handle profile image update
    if (req.files && req.files.profilePicture && req.files.profilePicture[0]) {
      // Only queue for deletion if a new file is uploaded and old file exists
      if (existingUser.profilePicture) {
        filesToDelete.push(existingUser.profilePicture);
      }
      profilePicture = req.files.profilePicture[0].filename;
    }

    // Handle citizenship front document
    if (
      req.files &&
      req.files.citizenshipFront &&
      req.files.citizenshipFront[0]
    ) {
      if (existingUser.citizenshipFront) {
        filesToDelete.push(existingUser.citizenshipFront);
      }
      citizenshipFront = req.files.citizenshipFront[0].filename;
    }

    // Handle citizenship back document
    if (
      req.files &&
      req.files.citizenshipBack &&
      req.files.citizenshipBack[0]
    ) {
      if (existingUser.citizenshipBack) {
        filesToDelete.push(existingUser.citizenshipBack);
      }
      citizenshipBack = req.files.citizenshipBack[0].filename;
    }
    // Disability Evidence
    if (
      req.files &&
      req.files.disabilityEvidence &&
      req.files.disabilityEvidence[0]
    ) {
      if (existingUser.disabilityEvidence) {
        filesToDelete.push(existingUser.disabilityEvidence);
      }
      disabilityEvidence = req.files.disabilityEvidence[0].filename;
    }

    // Prepare the update data with validation
    const updateData = {
      // New fields from the simplified frontend
      ...(targetCountry && { targetCountry }),
      ...(trainingDetails && { trainingDetails }),

      // Profile image (only update if new image is uploaded)
      ...(profilePicture !== existingUser.profilePicture && { profilePicture }),
      ...(citizenshipFront !== existingUser.citizenshipFront && {
        citizenshipFront,
      }),
      ...(citizenshipBack !== existingUser.citizenshipBack && {
        citizenshipBack,
      }),
      ...(disabilityEvidence !== existingUser.disabilityEvidence && {
        disabilityEvidence,
      }),
    };

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    );

    // Now that DB is updated successfully, delete old files
    if (filesToDelete.length > 0) {
      // Determine the upload directory based on your file uploader configuration
      // You may need to adjust this path to match where your files are being saved
      const uploadsDir = path.resolve(process.cwd(), "uploads", "files");

      // Try to delete each file
      filesToDelete.forEach((filename) => {
        const filePath = path.join(uploadsDir, filename);
        deleteFile(filePath);

        // Try alternate paths if file wasn't found at the primary location
        if (!deleteFile(filePath)) {
          // Try alternative paths if the first attempt failed
          const altPaths = [
            path.join(process.cwd(), "uploads", filename),
            path.join(process.cwd(), "public", "uploads", "files", filename),
            path.join(process.cwd(), "public", "uploads", filename),
          ];

          for (const altPath of altPaths) {
            if (deleteFile(altPath)) break;
          }
        }
      });
    }

    // Remove sensitive data before sending response
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully. Pending admin verification.",
      user: userResponse,
    });
  } catch (error) {
    console.error("Update Error:", error);

    // Handle specific mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
const userUploadImageRegister = async (req, res) => {
  try {
    const { userId } = req.params;
    // Find the user by ID
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // console.log(existingUser.fullName);
    // Store current file values
    let profilePicture = existingUser.profilePicture;

    // Keep track of files to delete
    const filesToDelete = [];

    // Function to delete file - with proper error handling
    const deleteFile = (filePath) => {
      try {
        // Check if file exists
        if (fs.existsSync(filePath)) {
          // Delete the file
          fs.unlinkSync(filePath);

          return true;
        }
        return false;
      } catch (err) {
        console.error(`Error deleting file ${filePath}: ${err.message}`);
        return false;
      }
    };

    // Handle profile image update
    if (req.files && req.files.profilePicture && req.files.profilePicture[0]) {
      // Only queue for deletion if a new file is uploaded and old file exists
      if (existingUser.profilePicture) {
        filesToDelete.push(existingUser.profilePicture);
      }
      profilePicture = req.files.profilePicture[0].filename;
    }

    // Prepare the update data with validation
    const updateData = {
      // Profile image (only update if new image is uploaded)
      ...(profilePicture !== existingUser.profilePicture && { profilePicture }),
    };

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    );

    // Now that DB is updated successfully, delete old files
    if (filesToDelete.length > 0) {
      // Determine the upload directory based on your file uploader configuration
      // You may need to adjust this path to match where your files are being saved
      const uploadsDir = path.resolve(process.cwd(), "uploads", "files");

      // Try to delete each file
      filesToDelete.forEach((filename) => {
        const filePath = path.join(uploadsDir, filename);
        deleteFile(filePath);

        // Try alternate paths if file wasn't found at the primary location
        if (!deleteFile(filePath)) {
          // Try alternative paths if the first attempt failed
          const altPaths = [
            path.join(process.cwd(), "uploads", filename),
            path.join(process.cwd(), "public", "uploads", "files", filename),
            path.join(process.cwd(), "public", "uploads", filename),
          ];

          for (const altPath of altPaths) {
            if (deleteFile(altPath)) break;
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "User profile image updated successfully.",
    });
  } catch (error) {
    console.error("Update Error:", error);

    // Handle specific mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
const setUserInterviewMarks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { interviewMarks } = req.body;

    // Find the user by ID
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    let newMarks = Number(interviewMarks);

    if (newMarks > 30 || newMarks < 0 || newMarks === undefined) {
      return res.status(400).json({
        success: false,
        message: "Invalid Interview Marks",
      });
    }
    let newTotal = newMarks + existingUser.marksObtained;

    existingUser.interviewMarks = newMarks ?? existingUser.interviewMarks;
    existingUser.totalMarks = newTotal ?? existingUser.interviewMarks;

    await existingUser.save();
    return res.status(200).json({
      success: true,
      message: `User interview marks successfully set to ${interviewMarks}`,
    });
  } catch (error) {
    console.error("Update Error:", error);

    // Handle specific mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

//***** Login User*****
const login = async (req, res) => {
  try {
    const { mobileNumberOrEmail, password } = req.body;
    // Get user's IP and user agent
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (!mobileNumberOrEmail || !password) {
      // Log failed login attempt (missing fields)
      await LoginLog.create({
        userId: null, // No user found
        email: mobileNumberOrEmail || "not provided",
        fullName: null, // No user found, so no name
        isSuccess: false,
        ip,
        userAgent,
      });

      return res.status(400).json({
        success: false,
        code: "AUTH_MISSING_FIELDS",
        message: "Email/mobile and password are required.",
      });
    }

    const user = await User.findOne({
      $or: [
        { mobileNumber: mobileNumberOrEmail },
        { email: mobileNumberOrEmail },
      ],
    });

    if (!user) {
      // Log failed login attempt (user not found)
      await LoginLog.create({
        userId: null, // No user found
        email: mobileNumberOrEmail,
        fullName: null, // No user found, so no name
        isSuccess: false,
        ip,
        userAgent,
      });

      return res.status(403).json({
        success: false,
        message: "User does not exist. Kindly register before proceeding.",
      });
    }

    if (user && user.isLocked) {
      // Log failed login attempt (account locked)
      await LoginLog.create({
        userId: user._id,
        email: mobileNumberOrEmail,
        fullName: user.fullName,
        isSuccess: false,

        ip,
        userAgent,
      });

      return res.status(403).json({
        success: false,
        code: "AUTH_LOCKED",
        message: "Your account is locked. Please contact support.",
      });
    }

    if (
      user.role === "user" &&
      user.adminVerification.accountStatus !== "selected"
    ) {
      // Log failed login attempt (account not selected)
      await LoginLog.create({
        userId: user._id,
        email: mobileNumberOrEmail,
        fullName: user.fullName,
        isSuccess: false,
        status: user.adminVerification.accountStatus,
        ip,
        userAgent,
      });

      return res.status(403).json({
        success: false,
        message: "Your account has not been selected yet, Please wait.",
      });
    }

    const passwordMatches = user
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!passwordMatches) {
      // Only increment if user exists
      if (user) {
        user.loginAttempts += 1;
        // lock if threshold reached
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.isLocked = true;
        }
        await user.save();

        // Log failed login attempt (invalid password)
        await LoginLog.create({
          userId: user._id,
          email: mobileNumberOrEmail,
          fullName: user.fullName,
          isSuccess: false,
          status:
            user.role === "user"
              ? user.adminVerification.accountStatus
              : user.role,
          ip,
          userAgent,
        });
      }

      return res.status(400).json({
        success: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message:
          "The email, mobile number, or password you entered is incorrect.",
        attemptsRemaining: user
          ? Math.max(0, MAX_LOGIN_ATTEMPTS - user.loginAttempts)
          : undefined,
      });
    }

    if (user.adminVerification.accountStatus === "dropped") {
      // Log failed login attempt (account rejected)
      await LoginLog.create({
        userId: user._id,
        email: mobileNumberOrEmail,
        fullName: user.fullName,
        isSuccess: false,

        ip,
        userAgent,
      });

      return res.status(403).json({
        success: false,
        code: "AUTH_REJECTED",
        message: "Your have been dropped out. Please contact support.",
      });
    }

    // Reset attempts on successful login
    user.loginAttempts = 0;
    user.isLocked = false;
    await user.save();

    // Log successful login
    await LoginLog.create({
      userId: user._id,
      email: mobileNumberOrEmail,
      fullName: user.fullName,
      isSuccess: true,
      status:
        user.role === "user" ? user.adminVerification.accountStatus : user.role,
      ip,
      userAgent,
    });

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Send success response
    return res.status(200).json({
      success: true,
      code: "AUTH_SUCCESS",
      message: "Login successful.",
      token,
      user: {
        _id: user._id,
        role: user.role,
        email: user.email,
        passwordChanged: user.passwordChanged,
        mobileNumber: user.mobileNumber,
        firstName: user.fullName.split(" ")[0],
      },
    });
  } catch (err) {
    console.error("Login Error:", err);

    // Log error during login process
    try {
      await LoginLog.create({
        userId: null,
        email: req.body.mobileNumberOrEmail || "unknown",
        fullName: null, // No user found or error occurred
        isSuccess: false,
        ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });
    } catch (logError) {
      console.error("Error logging login attempt:", logError);
    }

    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

// ****** Analytics New *******
const occupationsBySector = {
  ict: [
    "digitalMarketing",
    "drone",
    "robotics",
    "AI",
    "fiberOpticsTechnician",
    "cyberSecurity",
    "dotNet",
    "graphicDesign",
    "multimedia",
    "animation",
    "php",
    "java",
  ],
  specialAbility: ["houseKeepingPWD", "careService"],
  mechanicalAndElectronics: [
    "acRefrigeration",
    "cctvRepairing",
    "mobileRepair",
    "laptopRepair",
  ],
  garment: ["garmentFabricator", "basicFashionDesigning"],
  construction: ["electrician", "plumbing", "carpentry", "welding", "mason"],
  hospitality: ["barista", "waiter/waitress", "Fast Food Cook", "bakery"],
  automobile: ["electricVehicle", "motorcycleRepair", "lightVehicle"],
  artCulture: ["thanka", "ceramics"],
  agriculture: ["flowerDecorator"],
  service: [
    "beautician",
    "makeupHair",
    "nailTechnician",
    "barber",
    "stockMarket",
    "purohit",
    "wigMaker",
  ],
};
const getUserAnalytics = async (req, res) => {
  try {
    // Filter only users (not admin/instructor/volunteer)
    const { gender, onTimeRegistration } = req.query;
    // console.log(req.query);
    // Base filter for users with role "user"
    const baseFilter = { role: "user" };

    // Add gender filter if present
    if (gender && gender !== "") {
      baseFilter.gender = gender;
    }

    // Add onTimeRegistration filter if present
    if (onTimeRegistration) {
      if (onTimeRegistration === "true") {
        baseFilter.onTimeRegistration = true;
      }
    }

    // 1. Daily Registration Trend (based on createdAt)
    const dailyRegistrations = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 2. Application Status Count
    const applicationStatusCounts = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$adminVerification.accountStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // 3. Gender Distribution
    const genderDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]);

    // 4. Ethnicity Distribution
    const ethnicityDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$ethnicity",
          count: { $sum: 1 },
        },
      },
    ]);
    const occupationToSectorMap = {};
    for (const [sector, occupations] of Object.entries(occupationsBySector)) {
      for (const occupation of occupations) {
        occupationToSectorMap[occupation] = sector;
      }
    }

    // 5. Sector of Interest
    const overallSectorDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $addFields: {
          overallSector: {
            $switch: {
              branches: Object.entries(occupationToSectorMap).map(
                ([occupation, sector]) => ({
                  case: { $eq: ["$sectorOfInterest", occupation] },
                  then: sector,
                })
              ),
              default: "unknown",
            },
          },
        },
      },
      {
        $group: {
          _id: "$overallSector",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // 5. Sector of Interest
    const sectorDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$sectorOfInterest", // Grouping by sector
          count: { $sum: 1 }, // Counting the number of people in each sector
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // 6. Province
    const provinceDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$permanentProvince",
          count: { $sum: 1 },
        },
      },
    ]);
    // 6. Age Distribution
    const ageDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $project: {
          ageRange: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $gte: ["$age", 18] }, { $lte: ["$age", 25] }],
                  },
                  then: "18-25",
                },
                {
                  case: {
                    $and: [{ $gte: ["$age", 26] }, { $lte: ["$age", 40] }],
                  },
                  then: "26-40",
                },
                { case: { $gte: ["$age", 41] }, then: "41+" },
              ],
              default: "Unknown",
            },
          },
        },
      },
      {
        $group: {
          _id: "$ageRange",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyRegistrations,
        applicationStatusCounts,
        genderDistribution,
        ethnicityDistribution,
        sectorDistribution,
        overallSectorDistribution,
        provinceDistribution,
        ageDistribution,
      },
    });
  } catch (error) {
    console.error("Error generating analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error generating analytics data",
    });
  }
};

//Get All Users
const getAllUsers = async (req, res) => {
  try {
    const {
      search,
      accountStatus,
      otherInterest,
      sortMarks,
      sectorOfInterest,
      registeredPrev,
      isVolunteer,
      page = 1,
      limit = 10,
      gender,
      education,
      onTimeRegistration,
      isKathmandu,
    } = req.query;

    // Base query for users with role "user"
    let filterQuery = { role: "user" };
    if (isKathmandu === "ktm") {
      filterQuery["permanentDistrict"] = "Kathmandu District";
    } else if (isKathmandu === "landfill") {
      filterQuery["permanentMunicipality"] = { $in: ["Kakani", "Dhunibesi"] };
    }
    let onTimeRegistrationStatus = undefined;
    if (onTimeRegistration === "true") {
      filterQuery["onTimeRegistration"] = true;
      onTimeRegistrationStatus = true;
    }
    // Add other filters
    if (accountStatus && accountStatus !== "") {
      filterQuery["adminVerification.accountStatus"] = accountStatus;
    }
    if (gender && gender !== "") {
      filterQuery["gender"] = gender;
    }
    if (otherInterest && otherInterest !== "") {
      filterQuery["selectedOccupations"] = otherInterest;
    }
    // Correctly filter by sectorOfInterest
    if (sectorOfInterest && sectorOfInterest !== "") {
      filterQuery.sectorOfInterest = sectorOfInterest;
    }
    if (education && education !== "") {
      filterQuery["educationLevel"] = education;
    }
    if (registeredPrev && registeredPrev !== "") {
      if (registeredPrev === "true") {
        filterQuery.registeredPrev = true;
      } else if (registeredPrev === "false") {
        filterQuery.registeredPrev = false;
      } else if (registeredPrev === "verified") {
        filterQuery.prevRegVerified = true;
      } else if (registeredPrev === "notVerified") {
        filterQuery.$or = [
          { registeredPrev: true, prevRegVerified: false },
          { registeredPrev: true, prevRegVerified: { $exists: false } },
        ];
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filterQuery.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { citizenshipNumber: searchRegex },
        { applicantId: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let sortOptions = { totalMarks: 1, createdAt: 1 };
    if (sortMarks === "desc") {
      sortOptions = { totalMarks: -1, createdAt: 1 };
    } else if (sortMarks === "asc") {
      sortOptions = { totalMarks: 1, createdAt: 1 };
    } else if (sortMarks === "timeAsc") {
      sortOptions = { createdAt: -1 };
    } else {
      sortOptions = { createdAt: 1 };
    }

    // Count queries: only apply onTimeRegistration filter if "true"
    const baseCountQuery = {
      role: "user",
      ...(onTimeRegistrationStatus !== undefined && {
        onTimeRegistration: onTimeRegistrationStatus,
      }),
    };

    const totalUsers = await User.countDocuments(baseCountQuery);

    const totalAccepted = await User.countDocuments({
      "adminVerification.accountStatus": "accepted",
      ...baseCountQuery,
    });

    const totalSelected = await User.countDocuments({
      "adminVerification.accountStatus": "selected",
      ...baseCountQuery,
    });

    const totalAssigned = await User.countDocuments({
      "adminVerification.accountStatus": "assigned",
      ...baseCountQuery,
    });

    const totalPreviouslyRegistered = await User.countDocuments({
      registeredPrev: true,
      ...baseCountQuery,
    });
    const totalFilteredUsers = await User.countDocuments(filterQuery);
    let users;
    // Execute query with sorting first
    if (isVolunteer === "true" || isVolunteer === true) {
      users = await User.find(filterQuery)
        .select(
          "fullName mobileNumber sectorOfInterest totalMarks adminVerification.accountStatus applicantId profilePicture"
        )

        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));
    } else {
      users = await User.find(filterQuery)
        .select("-password -attendanceCheckIn -attendanceCheckOut -attendance")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));
    }
    res.status(200).json({
      success: true,
      users,
      userCount: totalUsers,
      acceptedCount: totalAccepted,
      selectedCount: totalSelected,
      assignedCount: totalAssigned,
      previouslyRegisteredCount: totalPreviouslyRegistered,
      totalPages: Math.ceil(totalFilteredUsers / parseInt(limit)),
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

// Controller to get a user by ID
const getUsersById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password -__v");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    let certificateDetails = await certificate.findOne(
      { "certificateDetails.traineeId": id },
      { "certificateDetails.$": 1 }
    );

    res.status(200).json({ user, certificateDetails });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const user = await User.findById(userId).select("-password -__v");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};
const getApplicantIdByContact = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone Number is required." });
    }

    const user = await User.findOne({ mobileNumber: phoneNumber }).select(
      "applicantId fullName sectorOfInterest adminVerification.accountStatus"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Controller to update a user by ID
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { accountStatus, location, date, time } = req.body;

    if (
      accountStatus === "selected" ||
      accountStatus === "shortlisted" ||
      accountStatus === "assigned"
    ) {
      if (!location || !date || !time) {
        return res
          .status(400)
          .json({ error: "Location, Date and Time is required." });
      }
    }
    if (accountStatus === "dropped") {
      user.adminVerification.accountStatus = "dropOut";
      user.isLocked = true;
      await user.save();

      // Send success response last
      res.status(200).json({
        success: true,
        message: `User status successfully set to ${accountStatus}`,
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.adminVerification.accountStatus = accountStatus;

    if (accountStatus === "selected") {
      const newPassword = generateStrongPassword(8);
      user.password = await bcrypt.hash(newPassword, 10);

      await Shortlist.create({
        user: user._id,
        location,
        date,
        time,
        status: "selected",
      });

      const smsText = `बधाई छ! 
तपाईं "${user.sectorOfInterest}" तालिमका लागि छनौट हुनुभएको छ। तालिममा सहभागीको लागि तल उल्लेखित स्थान र समयमा उपस्थित हुन अनुरोध गर्दछौं।
आवेदक आइडी: ${user.applicantId}
स्थान: ${location}
मिति: ${date} 
समय: ${time}
प्रणालीमा लगइन गर्नको लागि:
- वेबसाइट: https://kmc.seepmela.com/login
- युजरनेम: तपाईंले दर्ता गर्नुभएको फोन नम्बर
- पासवर्ड: ${newPassword}
धन्यवाद,
सिप मेला २०८२
का.म.पा`;
      const newMessageLog = new SelectionMessageLog({
        message: smsText,
        mobileNumber: user.mobileNumber,
      });
      await newMessageLog.save();
      // await sendSMS({ mobile: user.mobileNumber, message: smsText });

      // if (user.email) {
      //   await sendEmail({
      //     from: "tiu.kmc@gmail.com",
      //     to: user.email,
      //     subject: "Congratulations! You have been selected",
      //     html: selectionEmail(
      //       date,
      //       time,
      //       location,
      //       user.sectorOfInterest,
      //       newPassword
      //     ),
      //   });
      // }
    }

    if (accountStatus === "shortlisted") {
      await Shortlist.create({
        user: user._id,
        location,
        date,
        time,
        status: "shortlisted",
      });

      const smsText = `बधाई छ!
तपाईं सीपमेला २०८२ मा तालिमका लागि अन्तर्वार्ताको लागि छनौट हुनुभएको छ।
अन्तर्वार्ताको लागि तल उल्लेखित स्थान र समयमा उपस्थित हुन अनुरोध गर्दछौं।
स्थान: ${location}
मिति: ${date}
समय: ${time}
सीप मेला २०८२,
का.म.पा.`;

      await sendSMS({ mobile: user.mobileNumber, message: smsText });

      if (user.email) {
        await sendEmail({
          from: "tiu.kmc@gmail.com",
          to: user.email,
          subject: "Congratulations! You have been shortlisted",
          html: shortListEmail(date, time, location, user.sectorOfInterest),
        });
      }
    }
    if (accountStatus === "assigned") {
      await Shortlist.create({
        user: user._id,
        location,
        date,
        time,
        status: "shortlisted",
      });

      const smsText = `बधाई छ! 
तपाईं "${user.sectorOfInterest}" तालिम कक्षा सहभागी हुनका लागि छनौट हुनुभएको छ। कृपया तल उल्लेखित स्थान र समयमा उपस्थित हुनुहोस्।
स्थान: ${location}
मिति: ${date}
समय: ${time}
वेबसाइट: https://kmc.seepmela.com/login
आवेदक आइडी: ${user.applicantId}
धन्यवाद,
सिप मेला २०८२
का.म.पा`;

      // await sendSMS({ mobile: user.mobileNumber, message: smsText });

      // if (user.email) {
      //   await sendEmail({
      //     from: "tiu.kmc@gmail.com",
      //     to: user.email,
      //     subject: "Congratulations! You have been shortlisted",
      //     html: shortListEmail(date, time, location, user.sectorOfInterest),
      //   });
      // }
    }

    await user.save(); // Save everything AFTER setting properties

    // Send success response last
    res.status(200).json({
      success: true,
      message: `User status successfully set to ${accountStatus}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const updateUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -__v");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

//Change Password
const changePassword = async (req, res) => {
  const { mobileNumber, password, newPassword, confirmPassword } = req.body;
  if (!password || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Please enter all fields",
    });
  }

  try {
    // Fetch all users with the provided email
    const users = await User.find({
      mobileNumber: mobileNumber,
    });
    if (!users || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Mobile Number",
      });
    }
    // Change password

    // Iterate through each user and check passwords
    let passwordChanged = false;
    for (let user of users) {
      // Check if the first name matches (assuming case insensitive)

      // Compare passwords
      const isMatched = await bcrypt.compare(password, user.password);

      if (isMatched) {
        // Validate new password length
        if (newPassword.length < 6 || confirmPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: "Password must have at least 6 characters",
          });
        }
        if (password === newPassword) {
          return res.status(400).json({
            success: false,
            message: "New password should not be same as old password",
          });
        }
        // Compare new and confirm passwords
        if (newPassword !== confirmPassword) {
          return res.status(400).json({
            success: false,
            message: "New and Confirm Password did not match",
          });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password and plainTextPassword
        user.password = hashedPassword;
        user.passwordChanged = true;
        await user.save();

        passwordChanged = true;
        break;
      }
    }

    if (!passwordChanged) {
      return res.status(400).json({
        success: false,
        message: "Invalid Mobile Number or Incorrect old Password",
      });
    }
    const smsText = `धन्यवाद!
तपाईंको पासवर्ड सफलतापूर्वक परिवर्तन गरिएको छ।
नयाँ पासवर्ड: ${newPassword}
यदि तपाईंले पासवर्ड परिवर्तनको अनुरोध गर्नुभएको होइन भने, कृपया तुरुन्तै सहायता केन्द्र (Support) लाई सम्पर्क गर्नुहोस्।
सीप मेला २०८२,
का.म.पा.`;
    await sendSMS({ mobile: mobileNumber, message: smsText });

    return res.status(201).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getUserByInstiuition = async (req, res) => {
  try {
    const { institution } = req.query;
    const users = await User.find({
      "personalInformation.nameOfInstitution": institution,
    }).select("-password"); // Exclude password field
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

const getAllAttendees = async (req, res) => {
  try {
    const {
      search,
      accountStatus,
      sortMarks,
      sectorOfInterest,
      page = 1,
      limit = 10,
      date, // Parameter for date filtering
      attendanceStatus, // New parameter to filter by present/absent
    } = req.query;

    // Set default date to today if not provided
    const targetDate = date ? new Date(date) : new Date();

    // Format the target date to compare only year, month, and day
    const targetDateFormatted = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );

    // Base query for users with role "user"
    let filterQuery = {
      role: "user",
      "adminVerification.accountStatus": "assigned",
    };

    // Add other filters
    if (accountStatus && accountStatus !== "") {
      filterQuery["adminVerification.accountStatus"] = accountStatus;
    }

    // Correctly filter by sectorOfInterest
    if (sectorOfInterest && sectorOfInterest !== "") {
      filterQuery.sectorOfInterest = sectorOfInterest;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filterQuery.$or = [
        { fullName: searchRegex },

        { mobileNumber: searchRegex },
        { citizenshipNumber: searchRegex },
      ];
    }

    // Date range for the target date
    const startOfDay = new Date(targetDateFormatted);
    const endOfDay = new Date(
      targetDateFormatted.getTime() + 24 * 60 * 60 * 1000
    );

    // Filter by attendance status if specified
    if (attendanceStatus) {
      if (attendanceStatus === "present") {
        // Filter for present attendees on the target date
        filterQuery["attendanceCheckIn"] = {
          $elemMatch: {
            date: { $gte: startOfDay, $lt: endOfDay },
            status: true,
          },
        };
      } else if (attendanceStatus === "absent") {
        // Better way to find absent users - using aggregation to identify users
        // who don't have attendance records for the target date
        const presentUserIds = await User.distinct("_id", {
          role: "user",
          "adminVerification.accountStatus": "selected",
          attendanceCheckIn: {
            $elemMatch: {
              date: { $gte: startOfDay, $lt: endOfDay },
              status: true,
            },
          },
        });

        // Then exclude them from our query
        filterQuery["_id"] = { $nin: presentUserIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // We'll handle time-based sorting after we fetch the records
    // This will just be our database query sort for other fields
    let sortOptions = {};
    if (sortMarks === "desc") {
      sortOptions = { totalMarks: -1 };
    } else if (sortMarks === "asc") {
      sortOptions = { totalMarks: 1 };
    } else {
      // For time-based sorts, we'll do a default sort in the DB query
      // then handle the actual time sorting in memory after fetching data
      sortOptions = { fullName: 1 }; // Default alphabetical order for initial fetch
    }

    // Get total count for pagination info
    const totalUsers = await User.countDocuments({
      role: "user",
      "adminVerification.accountStatus": "selected",
    });

    // Count users matching the current filter query (for accurate pagination)
    const filteredUserCount = await User.countDocuments(filterQuery);

    const totalAccepted = await User.countDocuments({
      "adminVerification.accountStatus": "shortlisted",
    });
    const totalSelected = await User.countDocuments({
      "adminVerification.accountStatus": "selected",
    });
    const totalPreviouslyRegistered = await User.countDocuments({
      registeredPrev: { $in: [true, "true"] },
    });

    // Count users who attended on the target date
    const presentCount = await User.countDocuments({
      role: "user",
      "adminVerification.accountStatus": "selected",
      attendanceCheckIn: {
        $elemMatch: {
          date: { $gte: startOfDay, $lt: endOfDay },
          status: true,
        },
      },
    });

    const absentCount = totalUsers - presentCount;

    // Execute query with sorting and pagination
    const users = await User.find(filterQuery)
      .select(
        "attendanceCheckIn attendanceCheckOut fullName mobileNumber sectorOfInterest"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // For each user, find their check-in and check-out status for the target date
    let usersWithAttendance = users.map((user) => {
      const userObj = user.toObject();

      // Find check-in for target date
      const checkIn = user.attendanceCheckIn.find((entry) => {
        if (!entry || !entry.date) return false;

        const entryDate = new Date(entry.date);
        return (
          entryDate.getFullYear() === targetDateFormatted.getFullYear() &&
          entryDate.getMonth() === targetDateFormatted.getMonth() &&
          entryDate.getDate() === targetDateFormatted.getDate() &&
          entry.status === true
        );
      });

      // Find check-out for target date
      const checkOut = user.attendanceCheckOut.find((entry) => {
        if (!entry || !entry.date) return false;

        const entryDate = new Date(entry.date);
        return (
          entryDate.getFullYear() === targetDateFormatted.getFullYear() &&
          entryDate.getMonth() === targetDateFormatted.getMonth() &&
          entryDate.getDate() === targetDateFormatted.getDate() &&
          entry.status === true
        );
      });

      // Add detailed attendance info for the specific date
      userObj.attendance = {
        date: targetDateFormatted,
        status: checkIn?.status ? "present" : "absent",
        checkInTime: checkIn?.date
          ? new Date(checkIn.date).toLocaleTimeString()
          : null,
        checkOutTime: checkOut?.date
          ? new Date(checkOut.date).toLocaleTimeString()
          : null,
        // Store original Date object for sorting (not the string version)
        originalCheckInTime: checkIn?.date ? new Date(checkIn.date) : null,
      };

      return userObj;
    });

    // Sort the users based on check-in time for the selected date
    if (sortMarks === "timeAsc" || sortMarks === "timeDesc") {
      usersWithAttendance.sort((a, b) => {
        // If both have check-in times, sort by those times
        if (
          a.attendance.originalCheckInTime &&
          b.attendance.originalCheckInTime
        ) {
          return sortMarks === "timeAsc"
            ? a.attendance.originalCheckInTime -
                b.attendance.originalCheckInTime // Earliest first
            : b.attendance.originalCheckInTime -
                a.attendance.originalCheckInTime; // Latest first
        }

        // If only one has check-in time, that one comes first
        if (a.attendance.originalCheckInTime) return -1;
        if (b.attendance.originalCheckInTime) return 1;

        // If neither has check-in time, maintain original order (by name)
        return 0;
      });
    }

    // Remove the original date objects from the response since we don't need to send them
    usersWithAttendance = usersWithAttendance.map((user) => {
      const userObj = { ...user };
      delete userObj.attendance.originalCheckInTime;
      return userObj;
    });

    // Get average check-in time for the day
    const checkInRecords = await User.aggregate([
      {
        $match: {
          role: "user",
          "adminVerification.accountStatus": "selected",
          attendanceCheckIn: {
            $elemMatch: {
              date: { $gte: startOfDay, $lt: endOfDay },
              status: true,
            },
          },
        },
      },
      { $unwind: "$attendanceCheckIn" },
      {
        $match: {
          "attendanceCheckIn.date": { $gte: startOfDay, $lt: endOfDay },
          "attendanceCheckIn.status": true,
        },
      },
      {
        $group: {
          _id: null,
          averageCheckInTime: { $avg: { $hour: "$attendanceCheckIn.date" } },
        },
      },
    ]);

    const averageCheckInHour =
      checkInRecords.length > 0 ? checkInRecords[0].averageCheckInTime : null;

    // Get daily attendance counts for the last 30 days
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const dailyCheckIn = await User.aggregate([
      {
        $match: {
          role: "user",
          "adminVerification.accountStatus": "selected",
          attendanceCheckIn: {
            $elemMatch: {
              date: { $gte: oneYearAgo },
              status: true,
            },
          },
        },
      },
      { $unwind: "$attendanceCheckIn" },
      {
        $match: {
          "attendanceCheckIn.date": { $gte: oneYearAgo },
          "attendanceCheckIn.status": true,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$attendanceCheckIn.date",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } }, // Sort by date ascending
    ]);

    res.status(200).json({
      success: true,
      users: usersWithAttendance,
      userCount: totalUsers,
      filteredCount: filteredUserCount,
      acceptedCount: totalAccepted,
      selectedCount: totalSelected,
      previouslyRegisteredCount: totalPreviouslyRegistered,
      attendanceStats: {
        date: targetDateFormatted,
        presentCount,
        absentCount,
        presentPercentage:
          totalUsers > 0 ? (presentCount / totalUsers) * 100 : 0,
        averageCheckInHour,
      },
      dailyCheckIn,
      totalPages: Math.ceil(filteredUserCount / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users.",
      error: error.message,
    });
  }
};

// Daily Attendance Checkin
const markAttendanceCheckIn = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Log the current date being compared

    const alreadyMarked = user.attendanceCheckIn.some((attendanceCheckIn) => {
      const attendanceDate = new Date(
        attendanceCheckIn.date.$date || attendanceCheckIn.date
      );
      attendanceDate.setHours(0, 0, 0, 0);

      return attendanceDate.getTime() === today.getTime();
    });

    if (alreadyMarked) {
      return res
        .status(400)
        .json({ error: "Attendance already marked for today." });
    }

    user.attendanceCheckIn.push({ date: new Date(), status: true });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully.",
    });
  } catch (error) {
    console.error("Error in marking attendanceCheckIn:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

//Daily Attendance CheckOut
const markAttendanceCheckOut = async (req, res) => {
  try {
    const { userId } = req.params;
    const { overrideStatus } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Log the current date being compared

    const alreadyMarked = user.attendanceCheckOut.some((attendanceCheckOut) => {
      const attendanceDate = new Date(
        attendanceCheckOut.date.$date || attendanceCheckOut.date
      );
      attendanceDate.setHours(0, 0, 0, 0);

      return attendanceDate.getTime() === today.getTime();
    });

    const hasCheckedIn = user.attendanceCheckIn.some((attendanceCheckIn) => {
      const attendanceDate = new Date(
        attendanceCheckIn.date.$date || attendanceCheckIn.date
      );
      attendanceDate.setHours(0, 0, 0, 0);

      return attendanceDate.getTime() === today.getTime();
    });

    if (!hasCheckedIn && !overrideStatus) {
      return res
        .status(400)
        .json({ success: false, error: "User hasn't checked in yet" });
    }
    if (alreadyMarked) {
      return res
        .status(400)
        .json({ error: "Attendance already marked for today." });
    }

    user.attendanceCheckOut.push({ date: new Date(), status: true });
    if (overrideStatus) {
      user.attendanceCheckIn.push({ date: new Date(), status: true });
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully.",
    });
  } catch (error) {
    console.error("Error in marking attendanceCheckOut:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const generateQRCode = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const qrCodeText = `UserId: ${userId}`;
    const qrCodeOptions = {
      type: "png", // can also be svg, jpeg, etc.
      errorCorrectionLevel: "H", // higher error correction level
      quality: 0.92, // image quality factor
      margin: 1, // white space around QR codej
    };

    const qrCode = await QRCode.toDataURL(qrCodeText, qrCodeOptions);

    // Save the QR code data to user model
    user.qrCode = qrCode;
    await user.save();

    res.status(200).json({ success: true, qrCode });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const markMeal = async (req, res) => {
  try {
    const { userId, mealType } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyMarked = user.meals.some((meal) => {
      const mealDate = new Date(meal.date);
      mealDate.setHours(0, 0, 0, 0);
      return meal.type === mealType && mealDate.getTime() === today.getTime();
    });

    if (alreadyMarked) {
      return res.status(400).json({
        error: `${mealType} has already been marked for today.`,
      });
    }

    const newMeal = {
      type: mealType,
      date: new Date(), // Set the current date
      status: true,
    };

    user.meals.push(newMeal);
    await user.save();

    res.status(200).json({
      success: true,
      message: `${mealType} marked successfully for today.`,
    });
  } catch (error) {
    console.error("Error marking meal:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Mark excursion status
const markExcursion = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyMarked = user.excursions.some((excursion) => {
      const excursionDate = new Date(excursion.date);
      excursionDate.setHours(0, 0, 0, 0);
      return excursionDate.getTime() === today.getTime();
    });

    if (alreadyMarked) {
      return res.status(400).json({
        error: "Excursion has already been marked for today.",
      });
    }

    const newExcursion = {
      status: true,
      date: new Date(),
    };

    user.excursions.push(newExcursion);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Excursion marked successfully for today.",
    });
  } catch (error) {
    console.error("Error marking excursion:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get all participants with their meal and excursion statuses
const getMealsAndExcursions = async (req, res) => {
  try {
    const participants = await User.find({ isAdmin: false }).select(
      "personalInformation meals excursions"
    );
    res.status(200).json({ success: true, participants });
  } catch (error) {
    console.error("Error fetching participants:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Update meal status for a specific participant
const updateMealStatus = async (req, res) => {
  const { userId, mealType } = req.params;
  const { status } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const mealIndex = user.meals.findIndex((meal) => meal.type === mealType);
    if (mealIndex === -1) {
      return res
        .status(404)
        .json({ error: `${mealType} not found for user ${userId}.` });
    }

    user.meals[mealIndex].status = status;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: `${mealType} status updated.` });
  } catch (error) {
    console.error(`Error updating ${mealType} status:`, error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update excursion status for a specific participant
const updateExcursionStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.excursionAttended = status;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Excursion status updated." });
  } catch (error) {
    console.error("Error updating excursion status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
// Post Location
const postLocation = async (req, res) => {
  const { userid } = req.params;
  const { location, additionalNotes } = req.body;

  try {
    const user = await User.findById(userid);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const locationWithUser = await User.findByIdAndUpdate(
      userid,
      { $push: { locationHistory: { location, additionalNotes } } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      locationWithUser,
      message: "Location Updated Successfully",
    });
  } catch (error) {
    console.error("Error while posting location is:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

//getOnlyLocationWithUserId
const getOnlyLocationWithUserId = async (req, res) => {
  const { userid } = req.params;

  try {
    const user = await User.findById(userid).select("locationHistory");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.status(200).json({
      success: true,
      locationHistory: user.locationHistory,
      message: "Location fetched successfully.",
    });
  } catch (error) {
    console.error("Error while getting user with location:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

//getAllUserLocation
const getAllUserLocation = async (req, res) => {
  try {
    const users = await User.find().select(
      "locationHistory personalInformation"
    );
    res.status(200).json({
      success: true,
      users,
      message: "Location fetched successfully.",
    });
  } catch (error) {
    console.error("Error while getting all user with location:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    // Handle file uploads using multer
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "Error uploading file.",
          error: err.message,
        });
      }

      const userID = req.params.id;
      const updateData = req.body;
      const user = await User.findById(userID);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      // Handle profile picture update
      let userimage = user.personalInformation?.profilePicture?.fileName; // Default to existing image
      if (req.files?.userimage) {
        // Delete old image if it exists
        if (userimage) {
          const filePath = path.resolve(userimage);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        // Update to new image path
        userimage = req.files.userimage[0].path.replace(/\\/g, "/");
      }

      // Update fields dynamically
      const {
        title,
        firstName,
        middleName,
        lastName,
        nationality,
        dateOfBirth,
        email,
        currentAddress,
        highestEducationLevel,
        leoMultipleDistrictAndClubName,
        positionInDistrict,
        male,
        feMale,
        others,
        occupation,
        intlOccupationPassportNumber,
        whatsAppNumber,
        whyToAttend,
        uniqueness,
        achievementsTillNow,
        anySpecialSkillsOrQualifications,
        socialMediaHandle,
        currentMentalAndPhysicalHealth,
        notableThingsToKnow,
        emergencyContactNum,
        aggredToPayAmount,
        aggredToBeBestBehaviour,
        termsandcond,
        pictureuploadread,
        vegetarian,
        nonveg,
        other,
      } = updateData;

      // Assign new values or keep existing ones
      user.personalInformation = {
        ...user.personalInformation,
        title: title || user.personalInformation.title,
        fullName: {
          firstName: firstName || user.personalInformation.fullName.firstName,
          middleName:
            middleName || user.personalInformation.fullName.middleName,
          lastName: lastName || user.personalInformation.fullName.lastName,
        },
        nationality: nationality || user.personalInformation.nationality,
        dateOfBirth: dateOfBirth || user.personalInformation.dateOfBirth,
        email: email || user.personalInformation.email,
        currentAddress:
          currentAddress || user.personalInformation.currentAddress,
        highestEducationLevel:
          highestEducationLevel ||
          user.personalInformation.highestEducationLevel,
        leoMultipleDistrictAndClubName:
          leoMultipleDistrictAndClubName ||
          user.personalInformation.leoMultipleDistrictAndClubName,
        positionInDistrict:
          positionInDistrict || user.personalInformation.positionInDistrict,
        gender: {
          male:
            male === undefined ? user.personalInformation.gender.male : male,
          feMale:
            feMale === undefined
              ? user.personalInformation.gender.feMale
              : feMale,
          others:
            others === undefined
              ? user.personalInformation.gender.others
              : others,
        },
        occupation: occupation || user.personalInformation.occupation,
        intlOccupationPassportNumber:
          intlOccupationPassportNumber ||
          user.personalInformation.intlOccupationPassportNumber,
        whatsAppNumber:
          whatsAppNumber || user.personalInformation.whatsAppNumber,
        whyToAttend: whyToAttend || user.personalInformation.whyToAttend,
        uniqueness: uniqueness || user.personalInformation.uniqueness,
        achievementsTillNow:
          achievementsTillNow || user.personalInformation.achievementsTillNow,
        anySpecialSkillsOrQualifications:
          anySpecialSkillsOrQualifications ||
          user.personalInformation.anySpecialSkillsOrQualifications,
        socialMediaHandle:
          socialMediaHandle || user.personalInformation.socialMediaHandle,
        currentMentalAndPhysicalHealth:
          currentMentalAndPhysicalHealth ||
          user.personalInformation.currentMentalAndPhysicalHealth,
        notableThingsToKnow:
          notableThingsToKnow || user.personalInformation.notableThingsToKnow,
        emergencyContactNum:
          emergencyContactNum || user.personalInformation.emergencyContactNum,
        dietaryRequirements: {
          vegetarian:
            vegetarian === undefined
              ? user.personalInformation.dietaryRequirements.vegetarian
              : vegetarian,
          nonveg:
            nonveg === undefined
              ? user.personalInformation.dietaryRequirements.nonveg
              : nonveg,
          other: other || user.personalInformation.dietaryRequirements.other,
        },
        profilePicture: {
          fileName: userimage,
          uploadDate: new Date(),
        },
      };

      user.aggredToPayAmount = aggredToPayAmount || user.aggredToPayAmount;
      user.aggredToBeBestBehaviour =
        aggredToBeBestBehaviour || user.aggredToBeBestBehaviour;
      user.termsandcond = termsandcond || user.termsandcond;
      user.pictureuploadread = pictureuploadread || user.pictureuploadread;

      // Save the updated user
      await user.save();

      return res.status(200).json({
        success: true,
        message: "User profile updated successfully.",
        user,
      });
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

module.exports = {
  uploadFileMiddleware,
  userInitialRegistration,
  userRegister,
  getUserAnalytics,
  getAllUsers,
  getAllAttendees,
  getUserById,
  login,
  updateUserById,
  getUserByInstiuition,
  changePassword,
  markAttendanceCheckIn,
  markAttendanceCheckOut,
  generateQRCode,
  getUsersById,
  markExcursion,
  getMealsAndExcursions,
  updateMealStatus,
  updateExcursionStatus,
  postLocation,
  getOnlyLocationWithUserId,
  getAllUserLocation,
  markMeal,
  markExcursion,
  updateUserProfile,
  deleteImage,
  forgotPassword,
  resetPassword,
  updateUserStatus,
  setUserInterviewMarks,
  getApplicantIdByContact,
  userUploadImageRegister,
};
