const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
// Define storage for various image types including banner images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    switch (file.fieldname) {
      case "paymentReceipt":
        uploadPath = "public/uploads/paymentReceipts";
        break;
      case "userimage":
        uploadPath = "public/uploads/userimage";
        break;
      case "accompanyingimages":
        uploadPath = "public/uploads/accompanyingimages";
        break;
      case "bannerimage":
        uploadPath = "public/uploads/bannerimages";
        break;
      case "siteimage":
        uploadPath = "public/uploads/siteimage";
        break;
      case "venueimage":
        uploadPath = "public/uploads/venueimage";
        break;
      case "volunteerimage":
        uploadPath = "public/uploads/volunteerimage";
        break;
      case "coordinatorImage":
        uploadPath = "public/uploads/coordinator";
        break;
      case "onSiteRegisterImage":
        uploadPath = "public/uploads/onSiteRegisterImage";
        break;
      case "profileImage":
      case "instructorSignature":
        uploadPath = "public/uploads/instructorimage";
        break;
      default:
        uploadPath = "public/uploads/others";
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomString = crypto.randomBytes(8).toString("hex");
    const prefix = file.fieldname;
    cb(null, `${prefix}-${Date.now()}-${randomString}${ext}`);
  },
});
// File filter for images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
  ];
  if (!allowedFileTypes.includes(file.mimetype)) {
    return cb(new Error("File format not supported."), false);
  }
  cb(null, true);
};
const storageConfig = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
const upload = storageConfig.fields([
  { name: "userimage", maxCount: 1 },
  { name: "accompanyingimages", maxCount: 1 },
  { name: "paymentReceipt", maxCount: 1 },
  { name: "bannerimage", maxCount: 1 },
  { name: "siteimage", maxCount: 1 },
  { name: "venueimage", maxCount: 4 },
  { name: "volunteerimage", maxCount: 1 },
  { name: "coordinatorImage", maxCount: 1 },
  { name: "onSiteRegisterImage", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
  { name: "instructorSignature", maxCount: 1 },
]);
module.exports = upload;
