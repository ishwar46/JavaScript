const router = require("express").Router();
const RegNotification = require("../models/regNotification");
const authMiddleware = require("../middleware/routesAuth");

router.use(authMiddleware);

// GET /api/reg-notifications - get all notifications (admin only)
router.get("/", async (req, res) => {
  try {
    const data = await RegNotification.find()
      .sort({ createdAt: -1 })
      .limit(250)
      .populate("registrant", "fullName profilePicture");

    res.json({ success: true, regNotifications: data });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
});

// PATCH /api/reg-notifications/:id/read - mark notification as read (admin only)
router.patch("/:id/read", async (req, res) => {
  try {
    const notification = await RegNotification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await RegNotification.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: req.body._id },
    });

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
});
// PATCH /api/reg-notifications/:id/delete - delete notification (admin only)
router.delete("/:id/delete", async (req, res) => {
  try {
    const notification = await RegNotification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }
    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
});

// GET /api/reg-notifications/count - get unread notification count (admin only)
router.get("/count", async (req, res) => {
  try {
    const count = await RegNotification.countDocuments({
      readBy: { $nin: [req.user.id] },
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error counting notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to count notifications",
      error: error.message,
    });
  }
});

module.exports = router;
