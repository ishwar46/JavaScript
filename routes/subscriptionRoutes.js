const router = require("express").Router();
const subscriptionController = require("../controller/subscriptionController");
const authMiddleware = require("../middleware/routesAuth");

// Add a new subscriber with email
router.post("/addQueries", subscriptionController.addSubscription);

// Get all subscribers
router.get(
  "/getAllQueries",
  authMiddleware,
  subscriptionController.getAllSubscriptions
);
router.post(
  "/sendBulkMail",
  authMiddleware,
  subscriptionController.sendBulkEmail
);

module.exports = router;
