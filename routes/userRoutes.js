const router = require("express").Router();
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const userController = require("../controller/userController");
const authMiddleware = require("../middleware/routesAuth");
const userMiddleware = require("../middleware/userMiddleware");
const User = require("../models/user");
const mongoose = require("mongoose");
const volunteerMiddleware = require("../middleware/volunteerAuth");
const CoordinatorMiddleware = require("../middleware/coordinatorAuth");
const { volunteerOrInstructorAuth } = require("../middleware/instructorAuth");

router.use(mongoSanitize());

// limit to 10 attempts per 15 minutes per IP
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   handler: (req, res) => {
//     res.status(429).json({
//       success: false,
//       code: "TOO_MANY_REQUESTS",
//       message: "Too many login attempts. Please try again later.",
//     });
//   },
// });

// Public routes
router.post("/userInitialRegister", userController.userInitialRegistration);

router.patch(
  "/completeUserRegister/:userId",
  userMiddleware,
  userController.uploadFileMiddleware,
  userController.userRegister
);
router.patch(
  "/uploadProfileImage/:userId",
  volunteerMiddleware,
  userController.uploadFileMiddleware,
  userController.userUploadImageRegister
);
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password", userController.resetPassword);
router.post(
  "/userlogin",
  // Sanitize request body
  mongoSanitize(),

  // Validate + sanitize inputs
  body("mobileNumberOrEmail")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Email or mobile number is required.")
    .escape(),

  body("password")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Password is required."),

  // Check validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        code: "AUTH_VALIDATION_ERROR",
        message: errors
          .array()
          .map((e) => e.msg)
          .join(" "),
      });
    }
    next();
  },

  // Rate‑limit & handler
  // loginLimiter,
  userController.login
);

router.get("/gtusers", userController.getUserByInstiuition);
router.delete("/deleteImage", userController.deleteImage);
router.post("/change-password", userController.changePassword);
router.post(
  "/markAttendanceCheckIn/:userId",
  volunteerOrInstructorAuth,
  userController.markAttendanceCheckIn
);
router.post(
  "/markAttendanceCheckOut/:userId",
  volunteerOrInstructorAuth,
  userController.markAttendanceCheckOut
);
router.get("/generateQR/:userId", userController.generateQRCode);
router.post("/markExcursion", userController.markExcursion);
router.put("/:userid/location", userController.postLocation);
router.get("/location/:userid", userController.getOnlyLocationWithUserId);
// Route to get all participants with their meal and excursion statuses
router.get("/meals-and-excursions", userController.getMealsAndExcursions);

router.post("/markMeal", userController.markMeal);
router.post("/markExcursion", userController.markExcursion);

// Route to update meal status for a specific participant
router.put("/meals/:userId/:mealType", userController.updateMealStatus);

// Route to update excursion status for a specific participant
router.put("/excursions/:userId", userController.updateExcursionStatus);

// Routes accessible by any authenticated user
router.get("/getUserByid", userMiddleware, userController.getUserById);
router.get("/getUserByid/:id", userController.getUsersById);
router.get(
  "/findApplicantByPhone/:phoneNumber",
  userController.getApplicantIdByContact
);
router.put("/profile/:id", userController.updateUserProfile);

// Routes accessible by admin only
router.get(
  "/getAnalytics",
  volunteerMiddleware,
  userController.getUserAnalytics
);
router.get("/getAllUsers", volunteerMiddleware, userController.getAllUsers);

router.get(
  "/getAllAttendees",
  volunteerMiddleware,
  userController.getAllAttendees
);
router.patch(
  "/updateUserStatus/:userId",
  CoordinatorMiddleware,
  userController.updateUserStatus
);
router.put(
  "/updateInterviewMarks/:userId",
  volunteerMiddleware,
  userController.setUserInterviewMarks
);
router.get("/allUser", userMiddleware, userController.getAllUsers);
router.put("/:userId", userController.updateUserById);
router.get("/alllocation", userController.getAllUserLocation);
// POST /register-token
router.post("/register-token", async (req, res) => {
  const { userId, fcmToken } = req.body;
  try {
    const validUserId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(validUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.fcmToken = fcmToken;
    await user.save();
    res
      .status(200)
      .json({ success: true, message: "FCM token registered successfully" });
  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/getAllUserData", async (req, res) => {
  try {
    const {
      search,
      accountStatus,
      sortMarks,
      sectorOfInterest,
      registeredPrev,
      isVolunteer,
      gender,
    } = req.query;

    // Base query for users with role "user"
    let filterQuery = { role: "user" };

    // Add other filters
    if (accountStatus && accountStatus !== "") {
      filterQuery["adminVerification.accountStatus"] = accountStatus;
    }
    if (gender && gender !== "") {
      filterQuery["gender"] = gender;
    }

    // Correctly filter by sectorOfInterest
    if (sectorOfInterest && sectorOfInterest !== "") {
      filterQuery.sectorOfInterest = sectorOfInterest;
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
    if (isVolunteer && isVolunteer !== "") {
      filterQuery.isVolunteer = isVolunteer;
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

    // Get total count for pagination info
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalFilteredUsers = await User.countDocuments(filterQuery);
    const totalAccepted = await User.countDocuments({
      "adminVerification.accountStatus": "accepted",
      role: "user",
    });

    const totalSelected = await User.countDocuments({
      "adminVerification.accountStatus": "selected",
      role: "user",
    });

    const totalPreviouslyRegistered = await User.countDocuments({
      role: "user",
      registeredPrev: true,
    });
    let users = await User.find(filterQuery)
      .select(
        "-password -attendanceCheckIn -attendanceCheckOut -attendance -marksBreakdown -password -citizenshipIssueDistrict -createdAt -updatedAt -sameAsPermanent -temporaryProvince -temporaryDistrict -temporaryMunicipality -temporaryWardNo -_id -citizenshipIssuedDistrict -landfillSiteResident -OTPVerified -loginAttempts  "
      )
      .sort(sortOptions);

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users.",
    });
  }
});
module.exports = router;
