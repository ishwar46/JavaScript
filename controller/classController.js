const Class = require("../models/classModel");
const User = require("../models/user");
const Instructor = require("../models/instructor");
const { format, addDays, parseISO } = require("date-fns");
const { default: mongoose } = require("mongoose");

// Create a new class
const createClass = async (req, res) => {
  try {
    const {
      courseName,
      description,
      classroomNumber,
      instructor,
      classTime,
      startDate,
      duration,
      status,
    } = req.body;

    // Calculate end date based on start date and duration
    const endDate = addDays(new Date(startDate), duration);
    if (!courseName || !classroomNumber) {
      return res.status(400).json({
        success: false,
        message: "Course name and classroom number are required",
      });
    }
    const newClass = new Class({
      courseName,
      description,
      classroomNumber,
      instructor,
      classTime,
      startDate,
      endDate,
      duration,
      status,
    });

    await newClass.save();

    // Populate instructor details in the response
    const populatedClass = await Class.findById(newClass._id)
      .populate("instructor", "fullName email")
      .exec();

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      class: populatedClass,
    });
  } catch (err) {
    console.error("Error creating class:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// Get all classes with optional filtering
const getAllClasses = async (req, res) => {
  try {
    const { status, instructorId, search } = req.query;
    let filter = {};

    if (status) filter.status = status;
    if (instructorId) filter.instructor = instructorId;
    if (search) {
      filter.$or = [
        { courseName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { classroomNumber: { $regex: search, $options: "i" } },
      ];
    }

    const classes = await Class.find(filter)
      .populate("instructor", "fullName email")
      .populate("students", "fullName email")
      .sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      classes,
    });
  } catch (err) {
    console.error("Error fetching classes:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get classes",
      error: err.message,
    });
  }
};

// Get class by ID
const getClassById = async (req, res) => {
  try {
    const { classId } = req.params;

    const classData = await Class.findById(classId)
      .populate("instructor", "fullName email")
      .populate("students", "fullName email")
      .populate("attendance.studentAttendance.studentId", "fullName email");

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      class: classData,
    });
  } catch (err) {
    console.error("Error fetching class:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get class",
      error: err.message,
    });
  }
};

// Update class
const updateClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const {
      courseName,
      description,
      classroomNumber,
      instructor,
      classTime,
      startDate,
      duration,
      status,
    } = req.body;

    // Calculate end date based on start date and duration
    const endDate = addDays(new Date(startDate), duration);

    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      {
        courseName,
        description,
        classroomNumber,
        instructor,
        classTime,
        startDate,
        endDate,
        duration,
        status,
      },
      { new: true }
    )
      .populate("instructor", "fullName email")
      .populate("students", "fullName email");

    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      class: updatedClass,
    });
  } catch (err) {
    console.error("Error updating class:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update class",
      error: err.message,
    });
  }
};

// Delete class
const deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const deletedClass = await Class.findByIdAndDelete(classId);

    if (!deletedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting class:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete class",
      error: err.message,
    });
  }
};

const deleteStudentFromClass = async (req, res) => {
  const { classId, studentId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(classId) ||
    !mongoose.Types.ObjectId.isValid(studentId)
  ) {
    return res.status(400).json({ message: "Invalid ID format." });
  }

  try {
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      { $pull: { students: studentId } },
      { new: true }
    );

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found." });
    }

    // Update the user's role and account status
    const user = await User.findByIdAndUpdate(studentId, {
      $set: {
        "adminVerification.accountStatus": "selected",
      },
    });

    res.status(200).json({
      message: `${user.fullName} removed successfully and user updated.`,
      class: updatedClass,
    });
  } catch (error) {
    console.error("Error removing student:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// Assign students to class based on sectorOfInterest
const assignStudentsToClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentData } = req.body;

    // Validate input
    if (!Array.isArray(studentData) || studentData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No student IDs provided",
      });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Validate that student IDs exist and get their mobile numbers
    const validStudents = await User.find({
      _id: { $in: studentData },
    }).select("mobileNumber fullName");

    if (validStudents.length !== studentData.length) {
      return res.status(400).json({
        success: false,
        message: "Some student IDs are invalid",
      });
    }

    // Extract mobile numbers from valid students
    const mobileNumbers = validStudents
      .map((student) => student.mobileNumber)
      .filter((mobile) => mobile && mobile.trim() !== "");

    // Add new students to existing ones (avoid duplicates)
    const existingStudentIds = classData.students.map((id) => id.toString());
    const newStudents = studentData.filter(
      (id) => !existingStudentIds.includes(id.toString())
    );

    classData.students = [...classData.students, ...newStudents];

    // Save class with assigned students
    await classData.save();

    // Update student status to "assigned" (only for new students)
    await User.updateMany(
      { _id: { $in: newStudents } },
      {
        $set: {
          "adminVerification.accountStatus": "assigned",
        },
      }
    );

    // Populate students for the response
    const populatedClass = await Class.findById(classId)
      .populate("students", "fullName email adminVerification mobileNumber")
      .exec();

    res.status(200).json({
      success: true,
      message: `Students assigned successfully and status updated to "assigned"`,
      class: populatedClass,
      updatedStudentsCount: newStudents.length,
      smsNotificationsSent: mobileNumbers.length,
    });
  } catch (err) {
    console.error("Error assigning students:", err);
    res.status(500).json({
      success: false,
      message: "Failed to assign students",
      error: err.message,
    });
  }
};
// Add attendance for a class on a specific date
const addAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date, studentContact, present } = req.body;

    // Find the class
    const classData = await Class.findOne({
      $or: [{ _id: classId }, { instructor: classId }],
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Find the student
    const student = await User.findOne({ mobileNumber: studentContact }).select(
      "_id"
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Parse and validate the date
    let attendanceDate;
    try {
      attendanceDate = new Date(date);
      if (isNaN(attendanceDate.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // Convert present to proper status string
    const status = present === "true" || present === true ? true : false;

    // Calculate day number
    const startDate = new Date(classData.startDate);
    const dayNumber =
      Math.floor((attendanceDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    if (dayNumber < 1 || dayNumber > classData.duration) {
      return res.status(400).json({
        success: false,
        message: "Invalid date for this class duration",
      });
    }

    // Helper function to compare date parts only (ignoring time)
    const isSameDate = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // Check if attendance already exists for this date
    const existingAttendanceRecord = classData.attendance.find((att) =>
      isSameDate(new Date(att.date), attendanceDate)
    );

    if (existingAttendanceRecord) {
      const alreadyMarked = existingAttendanceRecord.studentAttendance.some(
        (s) => s.studentId.toString() === student._id.toString()
      );

      if (alreadyMarked) {
        return res.status(400).json({
          success: false,
          message: "Attendance already marked for this date",
        });
      }

      // Add to existing record
      existingAttendanceRecord.studentAttendance.push({
        studentId: student._id,
        status,
        markedAt: status === true ? new Date() : null,
      });
    } else {
      // Create new attendance record
      classData.attendance.push({
        date: attendanceDate,
        dayNumber,
        studentAttendance: [
          {
            studentId: student._id,
            status,
            markedAt: status === true ? new Date() : null,
          },
        ],
      });
    }

    await classData.save();

    const populatedClass = await Class.findById(classData._id)
      .populate(
        "attendance.studentAttendance.studentId",
        "fullName email mobileNumber"
      )
      .exec();

    res.status(200).json({
      success: true,
      message: "Attendance recorded successfully",
      class: populatedClass,
    });
  } catch (err) {
    console.error("Error recording attendance:", err);
    res.status(500).json({
      success: false,
      message: "Failed to record attendance",
      error: err.message,
    });
  }
};

// Get attendance for a class
const getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    // Use provided date or default to today's date
    const targetDate = date ? new Date(date) : new Date();

    // Set time to start of day for proper date comparison
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const classData = await Class.findOne({
      $or: [{ _id: classId }, { instructor: classId }],
    })
      .populate(
        "attendance.studentAttendance.studentId",
        "fullName mobileNumber"
      )
      .exec();

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Filter attendance by date
    const attendanceForDate = classData.attendance.find((att) => {
      const attDate = new Date(att.date);
      return attDate >= startOfDay && attDate <= endOfDay;
    });

    if (!attendanceForDate) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found for the specified date",
      });
    }

    // Transform the data to return only required fields
    const studentsAttendance = attendanceForDate.studentAttendance.map(
      (student) => ({
        fullName: student.studentId.fullName,
        mobileNumber: student.studentId.mobileNumber,
        status: student.status,
      })
    );

    res.status(200).json({
      success: true,
      date: attendanceForDate.date,
      dayNumber: attendanceForDate.dayNumber,
      attendance: studentsAttendance,
    });
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance",
      error: err.message,
    });
  }
};

// Get students in a class
const getStudentsInClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const classData = await Class.findById(classId)
      .populate("students", "fullName email mobileNumber")
      .exec();

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      students: classData.students,
    });
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get students",
      error: err.message,
    });
  }
};

// Get all instructors for dropdown
const getAllInstructorsForDropdown = async (req, res) => {
  try {
    const { search } = req.query;
    let filter = { isActive: true };

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const instructors = await Instructor.find(filter)
      .select("fullName email")
      .limit(10);

    res.status(200).json({
      success: true,
      instructors,
    });
  } catch (err) {
    console.error("Error fetching instructors:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get instructors",
      error: err.message,
    });
  }
};
// Get all students with status "selected"
const getSelectedStudents = async (req, res) => {
  try {
    const {
      search,
      sectorOfInterest,
      sortMarks,
      page = 1,
      limit = 10,
      gender,
      education,
      isKathmandu,
    } = req.query;

    // Base query for selected students
    let filterQuery = {
      role: "user",
      "adminVerification.accountStatus": "selected",
    };

    // Location filters
    if (isKathmandu === "ktm") {
      filterQuery["permanentDistrict"] = "Kathmandu District";
    } else if (isKathmandu === "landfill") {
      filterQuery["permanentMunicipality"] = { $in: ["Kakani", "Dhunibesi"] };
    }

    // Additional filters
    if (gender && gender !== "") {
      filterQuery["gender"] = gender;
    }

    if (sectorOfInterest && sectorOfInterest !== "") {
      filterQuery.sectorOfInterest = sectorOfInterest;
    }

    if (education && education !== "") {
      filterQuery["educationLevel"] = education;
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filterQuery.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { citizenshipNumber: searchRegex },
        { applicantId: searchRegex },
        { email: searchRegex },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting options
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

    // Get total count for pagination
    const totalFilteredStudents = await User.countDocuments(filterQuery);

    // Execute query with all filters, sorting, and pagination
    const students = await User.find(filterQuery)
      .select(
        "fullName email mobileNumber sectorOfInterest applicantId totalMarks selectedOccupations gender educationLevel createdAt profilePicture"
      )
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      students,
      count: students.length,
      totalCount: totalFilteredStudents,
      totalPages: Math.ceil(totalFilteredStudents / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Error fetching selected students:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch selected students",
      error: err.message,
    });
  }
};

// Get students assigned to a specific class
const getAssignedStudentsForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    // Set date to current date if not provided
    const targetDate = date ? new Date(date) : new Date();
    // Normalize to start of day for comparison
    targetDate.setHours(0, 0, 0, 0);

    const classData = await Class.findOne({
      $or: [{ _id: classId }, { instructor: classId }],
    })
      .populate("students", "fullName email mobileNumber")
      .exec();

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Find attendance record for the target date
    const attendanceRecord = classData.attendance.find((record) => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === targetDate.getTime();
    });

    // Map students with their attendance status
    const studentsWithAttendance = classData.students.map((student) => {
      let attendanceStatus = false; // Default to false if no record found

      if (attendanceRecord) {
        const studentAttendance = attendanceRecord.studentAttendance.find(
          (att) => att.studentId.toString() === student._id.toString()
        );
        attendanceStatus = studentAttendance ? studentAttendance.status : false;
      }

      return {
        _id: student._id,
        fullName: student.fullName,
        email: student.email,
        mobileNumber: student.mobileNumber,
        attendanceStatus: attendanceStatus,
      };
    });

    res.status(200).json({
      success: true,
      count: studentsWithAttendance.length,
      date: targetDate.toISOString().split("T")[0], // Return date in YYYY-MM-DD format
      students: studentsWithAttendance,
    });
  } catch (err) {
    console.error("Error fetching assigned students:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch assigned students",
      error: err.message,
    });
  }
};
const getAllStudentsForAttendance = async (req, res) => {
  try {
    const {
      date,
      search = "",
      status,
      className, // New filter for className
      classroomNumber,
      classFilter,
      sortBy = "fullName",
      sortOrder = "asc",
      page = 1,
      limit = 10,
    } = req.query;

    // Create a more consistent date handling
    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      // Use today's date in local timezone, but make it consistent
      const today = new Date();
      targetDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const classes = await Class.find({})
      .populate("students", "fullName mobileNumber _id ")
      .populate(
        "attendance.studentAttendance.studentId",
        "fullName mobileNumber"
      )
      .exec();

    if (!classes.length) {
      return res.status(404).json({
        success: false,
        message: "No classes found.",
      });
    }

    let allStudents = [];
    let uniqueClassRooms = new Set(); // To collect unique class-room combinations

    for (const classItem of classes) {
      if (classItem.courseName && classItem.classroomNumber) {
        const classRoomCombo = `${classItem.courseName}-${classItem.classroomNumber}`;
        uniqueClassRooms.add(classRoomCombo);
      }

      for (const student of classItem.students) {
        let statusValue = false;
        let dayNumber = null;
        let markedAt = null;

        const attendanceForDate = classItem.attendance.find((att) => {
          const attDate = new Date(att.date);
          const attDateOnly = new Date(
            attDate.getFullYear(),
            attDate.getMonth(),
            attDate.getDate()
          );
          const targetDateOnly = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            targetDate.getDate()
          );
          return attDateOnly.getTime() === targetDateOnly.getTime();
        });

        if (attendanceForDate) {
          const studentAttendance = attendanceForDate.studentAttendance.find(
            (s) =>
              s.studentId &&
              s.studentId._id.toString() === student._id.toString()
          );

          if (studentAttendance) {
            statusValue = studentAttendance.status;
            dayNumber = attendanceForDate.dayNumber;
            markedAt = studentAttendance.markedAt;
          }
        }

        allStudents.push({
          fullName: student.fullName,
          _id: student._id,
          mobileNumber: student.mobileNumber,
          className: classItem.courseName,
          classroomNumber: classItem.classroomNumber,
          classRoomCombo: `${classItem.courseName}-${classItem.classroomNumber}`, // New combined field
          status: statusValue,
          dayNumber,
          markedAt,
          date: targetDate.toISOString().split("T")[0],
        });
      }
    }

    // Calculate totals before filtering
    const totalStudents = allStudents.length;
    const totalPresent = allStudents.filter(
      (student) => student.status === true
    ).length;
    const totalAbsent = allStudents.filter(
      (student) => student.status === false
    ).length;
    const percentagePresent =
      totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(2) : 0;

    // Apply search filter
    if (search) {
      const lowerSearch = search.toLowerCase();
      allStudents = allStudents.filter(
        (student) =>
          student.fullName.toLowerCase().includes(lowerSearch) ||
          student.mobileNumber.includes(search) ||
          student.classRoomCombo.toLowerCase().includes(lowerSearch) // Include classRoomCombo in search
      );
    }

    // Apply combined classFilter (e.g., "AI-200")
    if (classFilter) {
      const filterParts = classFilter.split("-");
      if (filterParts.length >= 2) {
        const filterClassName = filterParts[0].trim();
        const filterClassroomNumber = filterParts.slice(1).join("-").trim(); // Handle cases with multiple dashes

        allStudents = allStudents.filter(
          (student) =>
            student.className.toLowerCase() === filterClassName.toLowerCase() &&
            student.classroomNumber === filterClassroomNumber
        );
      } else {
        // If format is invalid, return error
        return res.status(400).json({
          success: false,
          message:
            "Invalid classFilter format. Expected format: 'ClassName-RoomNumber' (e.g., 'AI-200')",
        });
      }
    }

    // Apply individual className filter (only if classFilter is not used)
    if (className && !classFilter) {
      allStudents = allStudents.filter(
        (student) => student.className.toLowerCase() === className.toLowerCase()
      );
    }

    // Apply individual classroomNumber filter (only if classFilter is not used)
    if (classroomNumber && !classFilter) {
      allStudents = allStudents.filter(
        (student) => student.classroomNumber === classroomNumber
      );
    }

    // Apply attendance status filter
    if (status === "present") {
      allStudents = allStudents.filter((student) => student.status === true);
    } else if (status === "absent") {
      allStudents = allStudents.filter((student) => student.status === false);
    }

    // Sorting
    allStudents.sort((a, b) => {
      const valueA = a[sortBy]?.toString().toLowerCase() || "";
      const valueB = b[sortBy]?.toString().toLowerCase() || "";

      if (sortOrder === "asc") {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedStudents = allStudents.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    res.status(200).json({
      success: true,
      date: targetDate.toISOString().split("T")[0],
      totalStudents,
      totalPresent,
      totalAbsent,
      percentagePresent: parseFloat(percentagePresent),
      filteredCount: allStudents.length,
      availableClassRooms: Array.from(uniqueClassRooms).sort(), // List of available class-room combinations
      students: paginatedStudents,
    });
  } catch (err) {
    console.error("Error fetching student list:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve student list.",
      error: err.message,
    });
  }
};

// Admin add attendance for any student
const adminAddAttendance = async (req, res) => {
  try {
    const { date, studentId, present } = req.body;
    console.log(req.body);
    if (!date || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Both date and studentId are required.",
      });
    }

    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format.",
      });
    }

    const status = present === "true" || present === true;

    // Find student (optional, for context)
    const student = await User.findById(studentId).select(
      "_id fullName mobileNumber"
    );

    // Helper to compare only the date part
    const isSameDate = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // Find class that contains the student in attendance
    let matchedClass = await Class.findOne({
      "attendance.studentAttendance.studentId": studentId,
    });

    // If no matching class with attendance found, try to find the student in any class
    if (!matchedClass) {
      matchedClass = await Class.findOne({
        students: studentId,
      });
    }

    if (!matchedClass) {
      return res.status(404).json({
        success: false,
        message: "No class found for the given student.",
      });
    }

    // Try to find the attendance record for the date
    let attendanceRecord = matchedClass.attendance.find((att) =>
      isSameDate(new Date(att.date), attendanceDate)
    );

    // If no attendance record for the date, create one
    if (!attendanceRecord) {
      const dayNumber =
        Math.floor(
          (attendanceDate - new Date(matchedClass.startDate)) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      attendanceRecord = {
        date: attendanceDate,
        dayNumber: Math.max(dayNumber, 1),
        studentAttendance: [],
      };

      matchedClass.attendance.push(attendanceRecord);
    }

    // Find if student already in studentAttendance
    const studentIndex = attendanceRecord.studentAttendance.findIndex(
      (s) => s.studentId.toString() === studentId
    );

    if (studentIndex !== -1) {
      // Update existing
      attendanceRecord.studentAttendance[studentIndex].status = status;
      attendanceRecord.studentAttendance[studentIndex].markedAt = status
        ? new Date()
        : null;
      attendanceRecord.studentAttendance[studentIndex].updatedAt = new Date();
    } else {
      // Add new attendance
      attendanceRecord.studentAttendance.push({
        studentId,
        status,
        markedAt: status ? new Date() : null,
      });
    }

    await matchedClass.save();

    res.status(200).json({
      success: true,
      message: `Attendance ${
        status ? "marked as present" : "marked as absent"
      } successfully.`,
      student: {
        id: studentId,
        name: student?.fullName || "N/A",
        mobileNumber: student?.mobileNumber || "N/A",
        attendanceStatus: status,
        date: attendanceDate.toISOString().split("T")[0],
        class: matchedClass.courseName,
      },
    });
  } catch (err) {
    console.error("Error recording attendance:", err);
    res.status(500).json({
      success: false,
      message: "Failed to record attendance",
      error: err.message,
    });
  }
};

// Get attendance history for a specific student
const getStudentAttendanceHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    // Find the student
    const student = await User.findById(studentId).select(
      "fullName mobileNumber"
    );
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      dateFilter = { $gte: new Date(startDate) };
    } else if (endDate) {
      dateFilter = { $lte: new Date(endDate) };
    }

    // Aggregate attendance records
    const pipeline = [
      { $unwind: "$attendance" },
      { $unwind: "$attendance.studentAttendance" },
      {
        $match: {
          "attendance.studentAttendance.studentId": new mongoose.Types.ObjectId(
            studentId
          ),
          ...(Object.keys(dateFilter).length > 0 && {
            "attendance.date": dateFilter,
          }),
        },
      },
      {
        $project: {
          date: "$attendance.date",
          dayNumber: "$attendance.dayNumber",
          status: "$attendance.studentAttendance.status",
          checkInTime: "$attendance.studentAttendance.checkInTime",
          className: "$name",
        },
      },
      { $sort: { date: -1 } },
    ];

    const attendanceRecords = await Class.aggregate(pipeline);

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedRecords = attendanceRecords.slice(
      skip,
      skip + parseInt(limit)
    );

    // Calculate statistics
    const totalRecords = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(
      (record) => record.status === true
    ).length;
    const absentDays = totalRecords - presentDays;

    res.status(200).json({
      success: true,
      student,
      attendanceHistory: paginatedRecords,
      statistics: {
        totalDays: totalRecords,
        presentDays,
        absentDays,
        attendancePercentage:
          totalRecords > 0 ? Math.round((presentDays / totalRecords) * 100) : 0,
      },
      totalPages: Math.ceil(totalRecords / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error getting student attendance history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance history",
      error: error.message,
    });
  }
};

// Get attendance summary for a specific date
const getAttendanceSummaryByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const attendanceDate = new Date(date);
    const startOfDay = new Date(attendanceDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(attendanceDate.setHours(23, 59, 59, 999));

    // Get attendance records for the date
    const attendanceData = await Class.aggregate([
      { $unwind: "$attendance" },
      {
        $match: {
          "attendance.date": {
            $gte: startOfDay,
            $lt: endOfDay,
          },
        },
      },
      { $unwind: "$attendance.studentAttendance" },
      {
        $lookup: {
          from: "users",
          localField: "attendance.studentAttendance.studentId",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      { $unwind: "$studentInfo" },
      {
        $project: {
          studentId: "$attendance.studentAttendance.studentId",
          studentName: "$studentInfo.fullName",
          mobileNumber: "$studentInfo.mobileNumber",
          status: "$attendance.studentAttendance.status",
          checkInTime: "$attendance.studentAttendance.checkInTime",
          className: "$name",
        },
      },
    ]);

    const presentStudents = attendanceData.filter(
      (record) => record.status === true
    );
    const absentStudents = attendanceData.filter(
      (record) => record.status === false
    );

    res.status(200).json({
      success: true,
      date: date,
      summary: {
        totalMarked: attendanceData.length,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
        attendancePercentage:
          attendanceData.length > 0
            ? Math.round((presentStudents.length / attendanceData.length) * 100)
            : 0,
      },
      presentStudents,
      absentStudents,
    });
  } catch (error) {
    console.error("Error getting attendance summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance summary",
      error: error.message,
    });
  }
};
module.exports = {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  assignStudentsToClass,
  addAttendance,
  getClassAttendance,
  getStudentsInClass,
  getAllInstructorsForDropdown,
  getSelectedStudents,
  getAssignedStudentsForClass,
  getAllStudentsForAttendance,
  adminAddAttendance,
  getStudentAttendanceHistory,
  getAttendanceSummaryByDate,
  deleteStudentFromClass,
};
