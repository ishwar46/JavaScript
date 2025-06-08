const jwt = require("jsonwebtoken");

/**
 * Socket.IO authentication middleware
 * Works with your existing JWT-based authentication
 */
const socketAuth = async (socket, next) => {
  try {
    // Get token from handshake auth or cookies or headers
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1] ||
      socket.handshake.headers.cookie
        ?.split(";")
        .find((c) => c.trim().startsWith("token="))
        ?.split("=")[1];

    if (!token) {
      console.warn(`No token found for socket ${socket.id}`);
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      // Verify the token using your existing JWT secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user data to socket for later use
      socket.user = decoded;
      next();
    } catch (tokenError) {
      console.warn(`Invalid token in socket connection: ${tokenError.message}`);
      return next(new Error("Authentication error: Invalid token"));
    }
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    next(new Error("Authentication error"));
  }
};

/**
 * Admin room handler - only allows admin users to join the admin room
 */
const setupAdminRoom = (io) => {
  io.on("connection", (socket) => {
    // Handle admin room membership with proper auth check
    socket.on("joinAdminRoom", () => {
      // Use the socket.user that was attached in the socketAuth middleware
      if (
        socket.user &&
        (socket.user.role === "admin" || socket.user.role === "superadmin")
      ) {
        socket.join("admins");
      } else {
        console.warn(`Unauthorized join attempt to admin room: ${socket.id}`);
      }
    });
  });
};

module.exports = { socketAuth, setupAdminRoom };
