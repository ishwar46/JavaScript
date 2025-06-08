const express = require("express");
const router = express.Router();
const classController = require("../controller/classController");
const {
  instructorAuth,
  instructorOrAdminAuth,
} = require("../middleware/instructorAuth");
const CoordinatorMiddleware = require("../middleware/coordinatorAuth");
const volunteerMiddleware = require("../middleware/volunteerAuth");

router.get("/instructor-verify", instructorAuth, (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User is an instructor.",
    });
  } catch (error) {
    console.error("Instructor Error:", error);
    return res.status(500).json({
      error: `Server error while getting user details: ${error.message}`,
    });
  }
});
// Admin-only routes
router.post("/create", CoordinatorMiddleware, classController.createClass);
router.get("/admin/all", CoordinatorMiddleware, classController.getAllClasses);
router.get(
  "/admin/:classId",
  volunteerMiddleware,
  classController.getClassById
);
router.put("/admin/:classId", volunteerMiddleware, classController.updateClass);
router.delete(
  "/admin/:classId",
  CoordinatorMiddleware,
  classController.deleteClass
);

router.post(
  "/admin/:classId/assign-students",
  CoordinatorMiddleware,
  classController.assignStudentsToClass
);
router.delete(
  "/admin/:classId/students/:studentId",
  CoordinatorMiddleware,
  classController.deleteStudentFromClass
);
router.get(
  "/admin/instructors/dropdown",
  CoordinatorMiddleware,
  classController.getAllInstructorsForDropdown
);
router.get(
  "/admin/students/selected",
  CoordinatorMiddleware,
  classController.getSelectedStudents
);
router.get(
  "/admin/:classId/students",
  instructorOrAdminAuth,
  classController.getAssignedStudentsForClass
);
// Instructor routes
router.post(
  "/instructor/:classId/attendance",
  instructorOrAdminAuth,
  classController.addAttendance
);
router.get(
  "/instructor/:classId/attendance",
  instructorOrAdminAuth,
  classController.getClassAttendance
);
router.get(
  "/instructor/:classId/students",
  instructorOrAdminAuth,
  classController.getStudentsInClass
);
router.get(
  "/admin/instructor/all-attendance",
  CoordinatorMiddleware,
  classController.getAllStudentsForAttendance
);
router.get(
  "/admin/attendance-history/:studentId",
  CoordinatorMiddleware,
  classController.getStudentAttendanceHistory
);
router.get(
  "/admin/attendance-summary/:date",
  CoordinatorMiddleware,
  classController.getAttendanceSummaryByDate
);
router.post(
  "/admin/instructor/attendance",
  CoordinatorMiddleware,
  classController.adminAddAttendance
);

// Shared routes (both admin and instructor)
router.get("/:classId", instructorOrAdminAuth, classController.getClassById);
router.get("/", instructorOrAdminAuth, classController.getAllClasses);

module.exports = router;
