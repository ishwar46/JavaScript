const router = require("express").Router();
const volunteerController = require("../controller/volunteerController");
const adminController = require("../controller/adminController");
const volunteerMiddleware = require("../middleware/volunteerAuth");

router.post("/login", volunteerController.volunteerLogin);
router.get(
  "/volunteer-verify",
  volunteerMiddleware,
  volunteerController.verifyVolunteer
);
router.get("/profile/:id", volunteerController.volunteerProfile);

router.post(
  "/orientation-checkin",
  volunteerMiddleware,
  adminController.checkInForEvent
);
router.get(
  "/orientation-attendance",
  volunteerMiddleware,
  adminController.getEventAttendance
);

module.exports = router;
