const router = require("express").Router();
const otpController = require("../controller/otpController");

router.post("/generateOTP", otpController.generateOTP);
router.post("/verifyOTP", otpController.verifyOTP);
router.post("/getOTPDetails", otpController.showOTPDetails);
module.exports = router;
