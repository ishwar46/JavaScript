const express = require("express");
const router = express.Router();
const instructorController = require("../controller/instructorController");

const {
  instructorAuth,
  instructorOrAdminAuth,
} = require("../middleware/instructorAuth");
const volunteerMiddleware = require("../middleware/volunteerAuth");
const authMiddleware = require("../middleware/routesAuth");
// Public routes
router.post("/register", instructorController.registerInstructor);

router.post("/login", instructorController.loginInstructor);

// Instructor only routes
router.get(
  "/profile",
  instructorAuth,
  instructorController.getInstructorProfile
);
router.put(
  "/profile",
  instructorAuth,
  instructorController.updateInstructorProfile
);
router.put(
  "/change-password",
  instructorAuth,
  instructorController.changeInstructorPassword
);
//admin only routes
router.post(
  "/admin-create-instructor",
  volunteerMiddleware,
  instructorController.adminCreateInstructor
);
router.patch(
  "/admin/updateInstructorStatus/:instructorId",
  volunteerMiddleware,
  instructorController.updateInstructorStatus
);
router.get(
  "/admin/all",
  volunteerMiddleware,
  instructorController.getAllInstructors
);
router.delete(
  "/admin/admin-bulk-delete",
  volunteerMiddleware,
  instructorController.deleteMultipleInstructors
);
router.get(
  "/admin/:instructorId",
  volunteerMiddleware,
  instructorController.getInstructorById
);
router.put(
  "/admin/:instructorId",
  volunteerMiddleware,
  instructorController.updateInstructor
);
router.delete(
  "/admin/:instructorId",
  volunteerMiddleware,
  instructorController.deleteInstructor
);
router.post("/reset-password", instructorController.resetPassword);
router.get(
  "/admin/reset-password/:instructorId",
  volunteerMiddleware,
  instructorController.resetInstructorPassword
);
router.post("/forgot-password", instructorController.forgotPassword);

module.exports = router;
