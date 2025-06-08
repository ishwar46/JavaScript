const router = require("express").Router();
const {
  adminRegister,
  adminLogin,
  adminVerifyUser,
  deleteUser,
  adminEditUser,
  adminResetPassword,
  updateConferenceKitStatus,
  postLiveStreamUrl,
  getLiveStreamUrl,
  deleteMultipleUsers,
  adminCheckInUser,
  adminGetCheckInList,
  createVolunteer,
  getAllVolunteer,
  deleteVolunteerById,
  updateVolunteerById,
  verifyAdmin,
  updateUserProfile,
  createCoordinator,
  deleteCoordinatorById,
  updateCoordinatorById,
  getAllCoordinators,
  checkInForEvent,
  getEventAttendance,
} = require("../controller/adminController");
const CoordinatorMiddleware = require("../middleware/coordinatorAuth");
const authMiddleware = require("../middleware/routesAuth");
const userMiddleware = require("../middleware/userMiddleware");
const volunteerMiddleware = require("../middleware/volunteerAuth");
router.get("/admin-verify", userMiddleware, authMiddleware, verifyAdmin);
router.post("/register", adminRegister);
router.post("/login", adminLogin);
router.put("/verify/:userId", adminVerifyUser);
router.delete("/delete/:userId", authMiddleware, deleteUser);
router.patch("/updateUser/:userId", CoordinatorMiddleware, updateUserProfile);
router.delete("/deleteMany", authMiddleware, deleteMultipleUsers);
router.put("/edit/:userId", adminEditUser);
router.patch("/reset-password/:userId", CoordinatorMiddleware, adminResetPassword);
router.put("/conference-kit/:userId", updateConferenceKitStatus);
// Admin posts the live stream URL
router.post("/livestream", postLiveStreamUrl);
router.get("/checkin-list", adminGetCheckInList);
router.put("/checkin/:userId", adminCheckInUser);

//Admin creating volunteer
router.post("/register/volunteer", authMiddleware, createVolunteer);
router.get("/getall/volunteer", volunteerMiddleware, getAllVolunteer);
router.delete("/delete/volunteer/:id", authMiddleware, deleteVolunteerById);
router.put("/update/volunteer/:id", authMiddleware, updateVolunteerById);

//Admin creating coordinator
router.post("/register/coordinator", authMiddleware, createCoordinator);
router.get("/getall/coordinator", CoordinatorMiddleware, getAllCoordinators);
router.delete("/delete/coordinator/:id", authMiddleware, deleteCoordinatorById);
router.put("/update/coordinator/:id", authMiddleware, updateCoordinatorById);
// Orientation Routes
router.post("/orientation-checkin", volunteerMiddleware, checkInForEvent);
router.get("/orientation-attendance", volunteerMiddleware, getEventAttendance);

module.exports = router;
