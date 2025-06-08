const router = require("express").Router();
const coordinatorController = require("../controller/coordinatorController");
const CoordinatorMiddleware = require("../middleware/coordinatorAuth");

router.post("/login", coordinatorController.coordinatorLogin);
router.get("/profile/:id", coordinatorController.coordinatorProfile);
router.get(
  "/coordinator-verify",
  CoordinatorMiddleware,
  coordinatorController.verifyCoordinator
);
router.get(
  "/coordinatorGetAllUsers",
  CoordinatorMiddleware,
  coordinatorController.coordinatorGetAllUsers
);
router.get(
  "/coordinatorGetAllUserAnalytics/:id",
  CoordinatorMiddleware,
  coordinatorController.coordinatorGetUserAnalytics
);
router.get(
  "/getAllAttendees",
  CoordinatorMiddleware,
  coordinatorController.getAllAttendees
);

module.exports = router;
