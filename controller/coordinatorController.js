const Coordinator = require("../models/coordinator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const occupationsBySector = {
  ict: [
    "digitalMarketing",
    "drone",
    "robotics",
    "AI",
    "fiberOpticsTechnician",
    "cyberSecurity",
    "dotNet",
    "graphicDesign",
    "multimedia",
    "animation",
    "php",
    "java",
  ],
  specialAbility: ["houseKeepingPWD", "careService"],
  mechanicalAndElectronics: [
    "acRefrigeration",
    "cctvRepairing",
    "mobileRepair",
    "laptopRepair",
  ],
  garment: ["garmentFabricator", "basicFashionDesigning"],
  construction: ["electrician", "plumbing", "carpentry", "welding", "mason"],
  hospitality: ["barista", "waiter/waitress", "Fast Food Cook", "bakery"],
  automobile: ["electricVehicle", "motorcycleRepair", "lightVehicle"],
  artCulture: ["thanka", "ceramics"],
  agriculture: ["flowerDecorator"],
  service: [
    "beautician",
    "makeupHair",
    "nailTechnician",
    "barber",
    "stockMarket",
    "purohit",
    "wigMaker",
  ],
};

const coordinatorGetAllUsers = async (req, res) => {
  try {
    const {
      search,
      accountStatus,
      sortMarks,
      sectorOfInterest,
      otherInterest,
      registeredPrev,
      gender,
      page = 1,
      limit = 10,
      id,
      onTimeRegistration,
      education,
      isKathmandu,
    } = req.query;
    let onTimeRegistrationStatus = undefined;
    // console.log(education);
    // Step 2: Get coordinator with their field
    const coordinator = await Coordinator.findById(id).select("field");

    // if (!coordinator) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Coordinator not found.",
    //   });
    // }

    // Step 3: Get the occupations associated with this coordinator's field
    const coordinatorField = coordinator?.field || "ict";
    const accessibleOccupations = occupationsBySector[coordinatorField] || [];

    if (accessibleOccupations.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        userCount: 0,
        acceptedCount: 0,
        selectedCount: 0,
        previouslyRegisteredCount: 0,
        totalPages: 0,
        currentPage: parseInt(page),
        message: "No accessible sectors assigned to this coordinator.",
      });
    }
    let filterQuery = {
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
    };
    if (isKathmandu === "ktm") {
      filterQuery["permanentDistrict"] = "Kathmandu District";
    } else if (isKathmandu === "landfill") {
      filterQuery["permanentMunicipality"] = { $in: ["Kakani", "Dhunibesi"] };
    }
    if (onTimeRegistration === "true") {
      filterQuery["onTimeRegistration"] = true;
      onTimeRegistrationStatus = true;
    }
    if (otherInterest && otherInterest !== "") {
      filterQuery["selectedOccupations"] = otherInterest;
    }
    // Base query filter for users with allowed occupations

    // Step 4: If sectorOfInterest query param is passed, filter inside accessible occupations
    if (sectorOfInterest && sectorOfInterest !== "") {
      const requestedOccupations = Array.isArray(sectorOfInterest)
        ? sectorOfInterest
        : sectorOfInterest.split(",").map((s) => s.trim());

      const allowedOccupations = requestedOccupations.filter((occ) =>
        accessibleOccupations.includes(occ)
      );

      filterQuery.sectorOfInterest = { $in: allowedOccupations };
    }

    if (accountStatus && accountStatus !== "") {
      filterQuery["adminVerification.accountStatus"] = accountStatus;
    }
    if (gender && gender !== "") {
      filterQuery["gender"] = gender;
    }
    if (education && education !== "") {
      filterQuery["educationLevel"] = education;
    }
    if (registeredPrev && registeredPrev !== "") {
      if (registeredPrev === "true") {
        filterQuery.registeredPrev = true;
      } else if (registeredPrev === "false") {
        filterQuery.registeredPrev = false;
      } else if (registeredPrev === "verified") {
        filterQuery.prevRegVerified = true;
      } else if (registeredPrev === "notVerified") {
        filterQuery.$or = [
          { registeredPrev: true, prevRegVerified: false },
          { registeredPrev: true, prevRegVerified: { $exists: false } },
        ];
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filterQuery.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { citizenshipNumber: searchRegex },
        { applicantId: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let sortOptions = { totalMarks: 1, createdAt: 1 };
    if (sortMarks === "desc") {
      sortOptions = { totalMarks: -1, createdAt: 1 };
    } else if (sortMarks === "asc") {
      sortOptions = { totalMarks: 1, createdAt: 1 };
    } else if (sortMarks === "timeAsc") {
      sortOptions = { createdAt: -1 };
    } else {
      sortOptions = { createdAt: 1 };
    }

    const totalUsers = await User.countDocuments({
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
      onTimeRegistration: onTimeRegistrationStatus,
    });
    const totalFilteredUsers = await User.countDocuments(filterQuery);
    const totalAccepted = await User.countDocuments({
      "adminVerification.accountStatus": "accepted",
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
      onTimeRegistration: onTimeRegistrationStatus,
      role: "user",
    });
    const totalSelected = await User.countDocuments({
      "adminVerification.accountStatus": "selected",
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
      onTimeRegistration: onTimeRegistrationStatus,
    });
    const totalPreviouslyRegistered = await User.countDocuments({
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
      onTimeRegistration: onTimeRegistrationStatus,
      registeredPrev: true,
    });

    const limitNum = parseInt(limit);

    const users = await User.find(filterQuery)
      .select("-password -attendanceCheckIn -attendanceCheckOut -attendance")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      users,
      userCount: totalUsers,
      acceptedCount: totalAccepted,
      selectedCount: totalSelected,
      previouslyRegisteredCount: totalPreviouslyRegistered,
      totalPages: Math.ceil(totalFilteredUsers / limitNum),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users.",
    });
  }
};

const coordinatorLogin = async (req, res) => {
  const { contact, password } = req.body;

  if (!contact || !password) {
    return res.status(400).json({
      success: false,
      message: "Contact and Password Are Required",
    });
  }

  try {
    const user = await Coordinator.findOne({ contact: contact });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This coordinator doesn't exist",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid Credentials.",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        fullName: user.fullName,
        address: user.address,
        contact: user.contact,
        field: user.field,
        isCoordinator: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "6 days" }
    );

    const { password: _, ...userWithoutPassword } = user.toObject();

    return res.status(200).json({
      success: true,
      message: "Coordinator logged in successfully.",
      token: token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error(`Error while logging in volunteer: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const coordinatorProfile = async (req, res) => {
  try {
    const user = await Coordinator.findById(req.params.id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No User Found for this id",
      });
    }

    return res.status(200).json({
      success: true,
      user,
      message: "Profile Fetched Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
const verifyCoordinator = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User is a coordinator or admin.",
    });
  } catch (error) {
    console.error("Admin User Error:", error);
    return res.status(500).json({
      error: `Server error while getting user details: ${error.message}`,
    });
  }
};
const coordinatorGetUserAnalytics = async (req, res) => {
  try {
    // Filter only users (not admin/instructor/volunteer)
    const { id } = req.params;

    const coordinator = await Coordinator.findById(id).select("field");
    // 1. Daily Registration Trend (based on createdAt)
    const coordinatorField = coordinator.field;
    const accessibleOccupations = occupationsBySector[coordinatorField] || [];
    if (accessibleOccupations.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        userCount: 0,
        acceptedCount: 0,
        selectedCount: 0,
        previouslyRegisteredCount: 0,
        totalPages: 0,
        currentPage: parseInt(page),
        message: "No accessible sectors assigned to this coordinator.",
      });
    }
    let baseFilter = {
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
    };
    const { gender, onTimeRegistration } = req.query;

    // Base filter for users with role "user"

    // Add gender filter if present
    if (gender) {
      baseFilter.gender = gender;
    }

    // Add onTimeRegistration filter if present
    if (onTimeRegistration === true) {
      baseFilter.onTimeRegistration = true;
    } else if (onTimeRegistration === "false") {
      baseFilter.onTimeRegistration = false;
    }

    const dailyRegistrations = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 2. Application Status Count
    const applicationStatusCounts = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$adminVerification.accountStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // 3. Gender Distribution
    const genderDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]);

    // 4. Ethnicity Distribution
    const ethnicityDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$ethnicity",
          count: { $sum: 1 },
        },
      },
    ]);

    // 5. Sector of Interest
    const sectorDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$sectorOfInterest", // Grouping by sector
          count: { $sum: 1 }, // Counting the number of people in each sector
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // 6. Province
    const provinceDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$permanentProvince",
          count: { $sum: 1 },
        },
      },
    ]);
    // 6. Age Distribution
    const ageDistribution = await User.aggregate([
      { $match: baseFilter },
      {
        $project: {
          ageRange: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $gte: ["$age", 18] }, { $lte: ["$age", 25] }],
                  },
                  then: "18-25",
                },
                {
                  case: {
                    $and: [{ $gte: ["$age", 26] }, { $lte: ["$age", 40] }],
                  },
                  then: "26-40",
                },
                { case: { $gte: ["$age", 41] }, then: "41+" },
              ],
              default: "Unknown",
            },
          },
        },
      },
      {
        $group: {
          _id: "$ageRange",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        dailyRegistrations,
        applicationStatusCounts,
        genderDistribution,
        ethnicityDistribution,
        sectorDistribution,
        provinceDistribution,
        ageDistribution,
      },
    });
  } catch (error) {
    console.error("Error generating analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error generating analytics data",
    });
  }
};
const getAllAttendees = async (req, res) => {
  try {
    const {
      search,
      accountStatus,
      sortMarks,
      sectorOfInterest,
      page = 1,
      limit = 10,
      date, // Parameter for date filtering
      attendanceStatus, // New parameter to filter by present/absent
      id,
    } = req.query;
    // console.log(id);
    // Set default date to today if not provided
    const targetDate = date ? new Date(date) : new Date();

    // Format the target date to compare only year, month, and day
    const targetDateFormatted = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    const coordinator = await Coordinator.findById(id).select("field");

    if (!coordinator) {
      return res.status(404).json({
        success: false,
        message: "Coordinator not found.",
      });
    }

    // Step 3: Get the occupations associated with this coordinator's field
    const coordinatorField = coordinator.field;
    const accessibleOccupations = occupationsBySector[coordinatorField] || [];

    if (accessibleOccupations.length === 0) {
      return res.status(200).json({
        success: true,
        users: [],
        userCount: 0,
        acceptedCount: 0,
        selectedCount: 0,
        previouslyRegisteredCount: 0,
        totalPages: 0,
        currentPage: parseInt(page),
        message: "No accessible sectors assigned to this coordinator.",
      });
    }

    // Base query filter for users with allowed occupations
    let filterQuery = {
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
      "adminVerification.accountStatus": "selected",
    };

    // Add other filters
    if (accountStatus && accountStatus !== "") {
      filterQuery["adminVerification.accountStatus"] = accountStatus;
    }

    // Correctly filter by sectorOfInterest
    if (sectorOfInterest && sectorOfInterest !== "") {
      filterQuery.sectorOfInterest = sectorOfInterest;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filterQuery.$or = [
        { fullName: searchRegex },

        { mobileNumber: searchRegex },
        { citizenshipNumber: searchRegex },
      ];
    }

    // Date range for the target date
    const startOfDay = new Date(targetDateFormatted);
    const endOfDay = new Date(
      targetDateFormatted.getTime() + 24 * 60 * 60 * 1000
    );

    // Filter by attendance status if specified
    if (attendanceStatus) {
      if (attendanceStatus === "present") {
        // Filter for present attendees on the target date
        filterQuery["attendanceCheckIn"] = {
          $elemMatch: {
            date: { $gte: startOfDay, $lt: endOfDay },
            status: true,
          },
        };
      } else if (attendanceStatus === "absent") {
        // Better way to find absent users - using aggregation to identify users
        // who don't have attendance records for the target date
        const presentUserIds = await User.distinct("_id", {
          role: "user",
          "adminVerification.accountStatus": "selected",
          attendanceCheckIn: {
            $elemMatch: {
              date: { $gte: startOfDay, $lt: endOfDay },
              status: true,
            },
          },
        });

        // Then exclude them from our query
        filterQuery["_id"] = { $nin: presentUserIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // We'll handle time-based sorting after we fetch the records
    // This will just be our database query sort for other fields
    let sortOptions = {};
    if (sortMarks === "desc") {
      sortOptions = { totalMarks: -1 };
    } else if (sortMarks === "asc") {
      sortOptions = { totalMarks: 1 };
    } else {
      // For time-based sorts, we'll do a default sort in the DB query
      // then handle the actual time sorting in memory after fetching data
      sortOptions = { fullName: 1 }; // Default alphabetical order for initial fetch
    }

    // Get total count for pagination info
    const totalUsers = await User.countDocuments({
      role: "user",
      sectorOfInterest: { $in: accessibleOccupations },
      "adminVerification.accountStatus": "selected",
    });

    // Count users matching the current filter query (for accurate pagination)
    const filteredUserCount = await User.countDocuments(filterQuery);

    const totalAccepted = await User.countDocuments({
      "adminVerification.accountStatus": "shortlisted",
    });
    const totalSelected = await User.countDocuments({
      "adminVerification.accountStatus": "selected",
    });
    const totalPreviouslyRegistered = await User.countDocuments({
      registeredPrev: { $in: [true, "true"] },
    });

    // Count users who attended on the target date
    const presentCount = await User.countDocuments({
      role: "user",
      "adminVerification.accountStatus": "selected",
      attendanceCheckIn: {
        $elemMatch: {
          date: { $gte: startOfDay, $lt: endOfDay },
          status: true,
        },
      },
    });

    const absentCount = totalUsers - presentCount;

    // Execute query with sorting and pagination
    const users = await User.find(filterQuery)
      .select(
        "attendanceCheckIn attendanceCheckOut fullName mobileNumber sectorOfInterest"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // For each user, find their check-in and check-out status for the target date
    let usersWithAttendance = users.map((user) => {
      const userObj = user.toObject();

      // Find check-in for target date
      const checkIn = user.attendanceCheckIn.find((entry) => {
        if (!entry || !entry.date) return false;

        const entryDate = new Date(entry.date);
        return (
          entryDate.getFullYear() === targetDateFormatted.getFullYear() &&
          entryDate.getMonth() === targetDateFormatted.getMonth() &&
          entryDate.getDate() === targetDateFormatted.getDate() &&
          entry.status === true
        );
      });

      // Find check-out for target date
      const checkOut = user.attendanceCheckOut.find((entry) => {
        if (!entry || !entry.date) return false;

        const entryDate = new Date(entry.date);
        return (
          entryDate.getFullYear() === targetDateFormatted.getFullYear() &&
          entryDate.getMonth() === targetDateFormatted.getMonth() &&
          entryDate.getDate() === targetDateFormatted.getDate() &&
          entry.status === true
        );
      });

      // Add detailed attendance info for the specific date
      userObj.attendance = {
        date: targetDateFormatted,
        status: checkIn?.status ? "present" : "absent",
        checkInTime: checkIn?.date
          ? new Date(checkIn.date).toLocaleTimeString()
          : null,
        checkOutTime: checkOut?.date
          ? new Date(checkOut.date).toLocaleTimeString()
          : null,
        // Store original Date object for sorting (not the string version)
        originalCheckInTime: checkIn?.date ? new Date(checkIn.date) : null,
      };

      return userObj;
    });

    // Sort the users based on check-in time for the selected date
    if (sortMarks === "timeAsc" || sortMarks === "timeDesc") {
      usersWithAttendance.sort((a, b) => {
        // If both have check-in times, sort by those times
        if (
          a.attendance.originalCheckInTime &&
          b.attendance.originalCheckInTime
        ) {
          return sortMarks === "timeAsc"
            ? a.attendance.originalCheckInTime -
                b.attendance.originalCheckInTime // Earliest first
            : b.attendance.originalCheckInTime -
                a.attendance.originalCheckInTime; // Latest first
        }

        // If only one has check-in time, that one comes first
        if (a.attendance.originalCheckInTime) return -1;
        if (b.attendance.originalCheckInTime) return 1;

        // If neither has check-in time, maintain original order (by name)
        return 0;
      });
    }

    // Remove the original date objects from the response since we don't need to send them
    usersWithAttendance = usersWithAttendance.map((user) => {
      const userObj = { ...user };
      delete userObj.attendance.originalCheckInTime;
      return userObj;
    });

    // Get average check-in time for the day
    const checkInRecords = await User.aggregate([
      {
        $match: {
          role: "user",
          "adminVerification.accountStatus": "selected",
          attendanceCheckIn: {
            $elemMatch: {
              date: { $gte: startOfDay, $lt: endOfDay },
              status: true,
            },
          },
        },
      },
      { $unwind: "$attendanceCheckIn" },
      {
        $match: {
          "attendanceCheckIn.date": { $gte: startOfDay, $lt: endOfDay },
          "attendanceCheckIn.status": true,
        },
      },
      {
        $group: {
          _id: null,
          averageCheckInTime: { $avg: { $hour: "$attendanceCheckIn.date" } },
        },
      },
    ]);

    const averageCheckInHour =
      checkInRecords.length > 0 ? checkInRecords[0].averageCheckInTime : null;

    // Get daily attendance counts for the last 30 days
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const dailyCheckIn = await User.aggregate([
      {
        $match: {
          role: "user",
          "adminVerification.accountStatus": "selected",
          attendanceCheckIn: {
            $elemMatch: {
              date: { $gte: oneYearAgo },
              status: true,
            },
          },
        },
      },
      { $unwind: "$attendanceCheckIn" },
      {
        $match: {
          "attendanceCheckIn.date": { $gte: oneYearAgo },
          "attendanceCheckIn.status": true,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$attendanceCheckIn.date",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } }, // Sort by date ascending
    ]);

    res.status(200).json({
      success: true,
      users: usersWithAttendance,
      userCount: totalUsers,
      filteredCount: filteredUserCount,
      acceptedCount: totalAccepted,
      selectedCount: totalSelected,
      previouslyRegisteredCount: totalPreviouslyRegistered,
      attendanceStats: {
        date: targetDateFormatted,
        presentCount,
        absentCount,
        presentPercentage:
          totalUsers > 0 ? (presentCount / totalUsers) * 100 : 0,
        averageCheckInHour,
      },
      dailyCheckIn,
      totalPages: Math.ceil(filteredUserCount / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users.",
      error: error.message,
    });
  }
};
module.exports = {
  coordinatorLogin,
  coordinatorProfile,
  coordinatorGetAllUsers,
  verifyCoordinator,
  coordinatorGetUserAnalytics,
  getAllAttendees,
};
