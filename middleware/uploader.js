const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
function createUploader(subfolderName) {
  const uploadPath = path.join(__dirname, "..", "uploads", subfolderName);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const randomString = crypto.randomBytes(16).toString("hex"); // 32 chars

      const fileName = `${baseName}-${randomString}${ext}`;

      // Initialize object to collect file paths
      if (!req.uploadedFilePaths) req.uploadedFilePaths = {};
      if (!req.uploadedFilePaths[file.fieldname]) {
        req.uploadedFilePaths[file.fieldname] = [];
      }

      req.uploadedFilePaths[file.fieldname].push(
        `/uploads/${subfolderName}/${fileName}`
      );

      cb(null, fileName);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 1 MB limit
    fileFilter: (req, file, cb) => {
      // Allow image files and PDF files
      if (
        file.mimetype.startsWith("image/") ||
        file.mimetype === "application/pdf"
      ) {
        cb(null, true);
      } else {
        cb(new Error("Only image and PDF files are allowed!"), false);
      }
    },
  });
}

module.exports = createUploader;
