const jwt = require("jsonwebtoken");
const Instructor = require("../models/instructor");

const instructorAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is an instructor
    if (decoded.role !== "instructor") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only instructors can access this resource.",
      });
    }

    // Check if instructor exists and is active
    const instructor = await Instructor.findById(decoded.id);

    if (!instructor) {
      return res.status(401).json({
        success: false,
        message: "Instructor not found",
      });
    }

    if (!instructor.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    // Set user in request
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Instructor authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Middleware to check if user is instructor or admin
const instructorOrAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check if user is an instructor or admin
    if (
      decoded.role !== "instructor" &&
      decoded.role !== "admin" &&
      decoded.role !== "superadmin" &&
      decoded.isCoordinator !== true &&
      decoded.isCoordinator !== "true"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only instructors or admins can access this resource.",
      });
    }

    // If user is instructor, check if instructor exists and is active
    if (decoded.role === "instructor") {
      const instructor = await Instructor.findById(decoded.id);

      if (!instructor) {
        return res.status(401).json({
          success: false,
          message: "Instructor not found",
        });
      }

      if (!instructor.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact admin.",
        });
      }
    }

    // Set user in request
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};
const volunteerOrInstructorAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check if user is an instructor or admin
    if (
      decoded.role !== "instructor" &&
      decoded.role !== "admin" &&
      decoded.role !== "superadmin" &&
      decoded.isCoordinator !== true &&
      decoded.isCoordinator !== "true" &&
      decoded.isVolunteer !== true &&
      decoded.isVolunteer !== "true"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only instructors or admins can access this resource.",
      });
    }

    // If user is instructor, check if instructor exists and is active
    if (decoded.role === "instructor") {
      const instructor = await Instructor.findById(decoded.id);

      if (!instructor) {
        return res.status(401).json({
          success: false,
          message: "Instructor not found",
        });
      }

      if (!instructor.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact admin.",
        });
      }
    }

    // Set user in request
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

module.exports = {
  instructorAuth,
  instructorOrAdminAuth,
  volunteerOrInstructorAuth,
};
