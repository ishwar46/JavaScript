// routes/verifyPrevReg.js
const express = require("express");
const xlsx = require("xlsx");
const path = require("path");
const authMiddleware = require("../middleware/routesAuth");
const { sendSMS } = require("../utils/smsSender");
const EXCEL_FILE_PATH = path.join(__dirname, "..", "data", "smsData3.xlsx");

const router = express.Router();

// Helper to wait for 1 second
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.get("/send-bulk-sms", authMiddleware, async (req, res) => {
  try {
    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const recipients = [];

    // Extract relevant data from all sheets
    workbook.SheetNames.forEach((sheetName) => {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });

      data.forEach((row) => {
        const message = row[1];
        const cleanMessage = message.replace(/\\n/g, "\n");

        const phone = row[2];
        if (message && phone) {
          recipients.push({ cleanMessage, phone });
        }
      });
    });

    // Send SMS to each recipient one by one
    for (const recipient of recipients) {
      try {
        await sendSMS({
          mobile: recipient.phone,
          message: recipient.cleanMessage,
        });

        console.log(`SMS sent to ${recipient.phone}`);
        await delay(1000); // wait for 1 second before next
      } catch (err) {
        console.error(`Failed to send SMS to ${recipient.phone}:`, err);
        return res.status(500).json({
          success: false,
          message: `Error sending SMS to ${recipient.phone}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "All SMS sent successfully",
    });
  } catch (error) {
    console.error("Error processing SMS sending:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
