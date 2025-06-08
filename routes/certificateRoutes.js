const express = require("express");
const router = express.Router();
const certificateController = require("../controller/certificateController");
const authMiddleware = require("../middleware/routesAuth");
router.get(
  "/verify-certificate/:certificateNumber",
  certificateController.verifyCertificate
);
router.patch(
  "/updateMayorDetails",
  authMiddleware,
  certificateController.uploadMayorSignatureImageMiddleware,
  certificateController.updateMayorDetails
);
router.patch(
  "/create-certificate/:userId",
  authMiddleware,
  certificateController.createCertificate
);
router.get(
  "/getMayorDetails",

  certificateController.getMayorDetails
);

module.exports = router;
