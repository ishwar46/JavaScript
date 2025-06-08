const express = require("express");
const router = express.Router();
const { sendBulkSMSMessage, getBulkSMSLogs } = require("../controller/bulkSmsController");

router.post("/send", sendBulkSMSMessage);
router.get("/logs", getBulkSMSLogs);

module.exports = router;