// routes/verifyPrevReg.js
const express = require("express");
const xlsx = require("xlsx");
const path = require("path");
const User = require("../models/user");
const authMiddleware = require("../middleware/routesAuth");

const router = express.Router();

// Path to the existing Excel file
const EXCEL_FILE_PATH = path.join(__dirname, "..", "data", "newDetails.xlsx");

// Nepali to English digit conversion function (inline)
function convertNepaliToEnglish(str) {
  const map = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
  };

  return (str || "")
    .toString()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^0-9]/g, ""); // Remove all non-numeric characters
}

// Route: POST /api/users/verify-prev-registration
router.post("/verify-prev-registration", authMiddleware, async (req, res) => {
  try {
    // Step 1: Get all eligible users
    const users = await User.find({
      registeredPrev: true,
      alreadyTakenTraining: false,
    });
    // Step 2: Normalize each user's mobileNumber and citizenshipNumber
    const userData = users.map((user) => {
      const mobile = convertNepaliToEnglish(user.mobileNumber);
      const citizenship = convertNepaliToEnglish(user.citizenshipNumber);

      return { user, mobile, citizenship };
    });
    // Step 3: Read Excel and extract col 3 and 10 values (indexes 2 and 9)
    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const col4Set = new Set();
    const col10Set = new Set();
    workbook.SheetNames.forEach((sheetName) => {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });
      data.forEach((row) => {
        const col4 = convertNepaliToEnglish(row[3]); // Citizenship number
        const col10 = convertNepaliToEnglish(row[9]); // Phone number

        if (col4) col4Set.add(col4);
        if (col10) col10Set.add(col10);
      });
    });

    // Step 4: Match users and update
    const updatedUsers = [];

    for (const { user, mobile, citizenship } of userData) {
      // console.log(col4Set.size);
      // console.log(col10Set.size);
      if (col10Set.has(mobile) || col4Set.has(citizenship)) {
        user.prevRegVerified = true;
        await user.save();
        updatedUsers.push(user._id);
      }
    }

    res.json({
      message: "Verification complete.",
      verifiedCount: updatedUsers.length,
      verifiedUserIds: updatedUsers,
    });
  } catch (err) {
    console.error("Error during verification:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
