const express = require("express");
const dotenv = require("dotenv");
const connectToDB = require("./database/db");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseconfig/firebase-config.json");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const { socketAuth, setupAdminRoom } = require("./socket-auth");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
// creating an express app
const app = express();
// configuring dotenv to use the .env file
dotenv.config();
// Create an HTTP server
const server = http.createServer(app);
// Set up Socket.IO with CORS settings
const io = socketIo(server, {
  cors: {
    origin: true,
    // origin: [
    //   "https://kmc.seepmela.com",
    //   "https://www.kmc.seepmela.com",
    //   "https://seepmela.com",
    //   "https://www.seepmela.com",
    //   "https://seep-mela-kmc-client.vercel.app",
    // ],
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "authorization", "Content-Type"],
  },
});

// Apply socket authentication middleware
io.use(socketAuth);
// Setup admin room handler
setupAdminRoom(io);
const corsOptions = {
  origin: true,
  // origin: [
  //   "https://kmc.seepmela.com",
  //   "https://www.kmc.seepmela.com",
  //   "https://seepmela.com",
  //   "https://www.seepmela.com",
  //   "https://seep-mela-kmc-client.vercel.app",
  // ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "authorization", "Content-Type"],
  optionsSuccessStatus: 200,
};

// Pass the Socket.IO instance to the routes
app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// connecting to database
connectToDB();
// accepting json dataa
app.use(express.json());
// accepting form data
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", true);
const directories = [
  "public/uploads",
  "public/uploads/userimage",
  "public/uploads/bannerimages",
  "public/uploads/venueimage",
  "public/uploads/siteimage",
  "public/uploads/volunteerimage",
  "public/uploads/instructorimage",
  "public/uploads/files",
  "public/uploads/coordinator",
];
directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/public/uploads",
  express.static(path.join(__dirname, "public/uploads"))
);
app.use(
  "/public/uploads/userimage",
  express.static(path.join(__dirname, "public/uploads/userimage"))
);
app.use(
  "/public/uploads/bannerimages",
  express.static(path.join(__dirname, "public/uploads/bannerimages"))
);
app.use(
  "/public/uploads/instructorimage",
  express.static(path.join(__dirname, "public/uploads/instructorimage"))
);
app.use(helmet());
app.use(express.json());
app.use(mongoSanitize());
app.use("/api/queries", require("./routes/subscriptionRoutes"));
app.use("/api/gallery", require("./routes/galleryRoutes"));
app.use("/api/speaker", require("./routes/speakerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/banners", require("./routes/bannerRoutes"));
app.use("/api/venue", require("./routes/venueRoutes"));
app.use("/api/herosection", require("./routes/heroRoutes"));
app.use("/api/volunteer", require("./routes/volunteerRoutes"));
app.use("/api/instructor", require("./routes/instructorRoutes"));
app.use("/api/otp", require("./routes/otpRoutes"));
app.use("/api/reg-notifications", require("./routes/regNotificationRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/certificates", require("./routes/certificateRoutes"));
app.use("/api/partner", require("./routes/partnerRoutes"));
app.use("/api/shortlists", require("./routes/shortlistRoutes"));
app.use("/api/xlsx", require("./routes/xlsxRoutes"));
app.use("/api/sms", require("./routes/sendSmsRoutes"));
app.use("/api/coordinator", require("./routes/coordinatorRoutes"));
app.use("/api/login-logs", require("./routes/loginLogsRoutes"));
app.use("/api/bulk-sms", require("./routes/bulkSmsRoutes"));
app.use("/api/blogs", require("./routes/blogRoutes"));
app.use("/api/course", require("./routes/classRoutes"));

app.get("/", (req, res, next) => {
  res.status(200).send("Hello world!");
});
// Socket.IO connection handler
io.on("connection", (socket) => {
  // Handle notifications
  socket.on("sendNotification", (notification) => {
    io.emit("receiveNotification", notification);
  });
  // Handle disconnection of socket
  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
  });
});
// Defining port
const PORT = process.env.PORT || 5500;
// running the server on port 5000
server.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
