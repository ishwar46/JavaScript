const express = require("express");
const shortlistController = require("../controller/shortlistController");

const volunteerMiddleware = require("../middleware/volunteerAuth");
const authMiddleware = require("../middleware/routesAuth");
const router = express.Router();

router.get(
  "/getallshortlists",
  volunteerMiddleware,
  shortlistController.getAllShortlists
);
router.delete(
  "/deleteshortlist/:id",
  authMiddleware,
  shortlistController.deleteShortlistById
);

module.exports = router;
