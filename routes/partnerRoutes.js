const express = require("express");
const router = express.Router();
const partnerController = require("../controller/partnerController");
const authMiddleware = require("../middleware/routesAuth");
router.get("/getAllPartners", authMiddleware, partnerController.getAllPartners);
router.get("/get-approved-partners", partnerController.getAllApprovedPartners);
router.post(
  "/register-partner",
  partnerController.uploadPartnerLogoMiddleware,
  partnerController.registerPartner
);
router.post(
  "/add-partners",
  authMiddleware,
  partnerController.uploadPartnerLogoMiddleware,
  partnerController.addPartner
);
router.patch(
  "/verify-partner/:partnerId",
  authMiddleware,
  partnerController.verifyPartner
);
router.patch(
  "/update-partner/:partnerId",
  authMiddleware,
  partnerController.uploadPartnerLogoMiddleware,
  partnerController.updatePartner
);
router.delete(
  "/delete-partner/:partnerId",
  authMiddleware,
  partnerController.deletePartner
);

module.exports = router;
