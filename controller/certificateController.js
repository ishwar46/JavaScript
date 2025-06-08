const createUploader = require("../middleware/uploader");
const Certificate = require("../models/certificate.js");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const mayorSignatureUploader = createUploader("mayor").fields([
  { name: "mayorSignature", maxCount: 1 },
  { name: "deputyMayorSignature", maxCount: 1 },
]);
// Middleware wrapper for file uploads
exports.uploadMayorSignatureImageMiddleware = (req, res, next) => {
  mayorSignatureUploader(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};
const PDFDocument = require("pdfkit");
const Instructor = require("../models/instructor.js");

// Helper function to jump lines
function jumpLine(doc, lines) {
  for (let index = 0; index < lines; index++) {
    doc.moveDown();
  }
}

async function generateCertificatePDF(
  certificateDetail,
  mayorDetails,
  instructorSignature,
  outputPath
) {
  // Reduce font sizes to ensure everything fits on one page
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document - using A4 landscape for more width
      const doc = new PDFDocument({
        layout: "landscape",
        size: "A4",
        autoFirstPage: true,
        // Set margins to be smaller to maximize space
        margin: 0,
      });

      // Register Nepali font with PDFKit
      // You need to download and place this font in your assets folder
      const nepaliFont = path.join(
        __dirname,
        "../assets/fonts/NotoSansDevanagari-Regular.ttf"
      );

      // Register the font with PDFKit
      doc.registerFont("Nepali", nepaliFont);

      // Pipe the PDF to a file
      const certificateFileName = `certificate-${certificateDetail.certificateNumber}.pdf`;
      const outputFilePath = path.join(outputPath, certificateFileName);

      // Create directory if it doesn't exist
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // Create write stream
      const stream = fs.createWriteStream(outputFilePath);
      doc.pipe(stream);

      // Set background image or texture (if available)
      try {
        const backgroundTexturePath = path.join(
          __dirname,
          "../assets/parchment-texture.jpg"
        );
        if (fs.existsSync(backgroundTexturePath)) {
          doc.image(backgroundTexturePath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          });
        } else {
          // Fallback: Set white background
          doc.rect(0, 0, doc.page.width, doc.page.height).fill("#fff");

          // Add subtle texture pattern using vector graphics
          const patternSize = 20;
          doc.fillOpacity(0.03);
          doc.fillColor("#000");

          for (let x = 0; x < doc.page.width; x += patternSize) {
            for (let y = 0; y < doc.page.height; y += patternSize) {
              if ((x + y) % (patternSize * 2) === 0) {
                doc.circle(x, y, 2).fill();
              }
            }
          }
          doc.fillOpacity(1);
        }
      } catch (error) {
        // console.log(
        //   "Error adding background texture, using plain background:",
        //   error.message
        // );
        doc.rect(0, 0, doc.page.width, doc.page.height).fill("#fff");
      }

      // ADD WATERMARK HERE - MOVED EARLIER TO BE BEHIND EVERYTHING
      // Nepal skyline watermark at the bottom half
      const svgDataUrl = path.join(__dirname, "../assets/adminBg.png");
      doc.opacity(0.45); // Higher opacity as requested (45%)
      try {
        // Position the skyline for the bottom half of the certificate
        const watermarkHeight = doc.page.height / 2; // Half the page height
        doc.image(svgDataUrl, 0, doc.page.height - watermarkHeight, {
          width: doc.page.width,
          height: watermarkHeight, // Full bottom half
        });
      } catch (error) {
        // console.log(
        //   "Error adding skyline image, using alternative approach:",
        //   error.message
        // );
      }
      doc.opacity(1); // Reset opacity for all subsequent elements

      // Create decorative border
      const distanceMargin = 18;

      // Outer decorative border
      doc
        .fillOpacity(1)
        .strokeOpacity(1)
        .fillAndStroke("#0e8cc3", "#0e8cc3")
        .lineWidth(20)
        .lineJoin("round")
        .rect(
          distanceMargin,
          distanceMargin,
          doc.page.width - distanceMargin * 2,
          doc.page.height - distanceMargin * 2
        )
        .stroke();

      // Inner decorative border (gold/accent) - thinner
      doc
        .fillOpacity(1)
        .strokeOpacity(1)
        .fillAndStroke("#fff", "#d4af37")
        .lineWidth(1) // Thinner line
        .lineJoin("miter")
        .rect(
          distanceMargin + 8,
          distanceMargin + 8,
          doc.page.width - (distanceMargin + 8) * 2,
          doc.page.height - (distanceMargin + 8) * 2
        )
        .stroke();

      // Add decorative corner ornaments - smaller
      const cornerSize = 30; // Smaller corners
      const cornerMargin = distanceMargin + 12;

      // Function to draw a decorative corner
      function drawCorner(x, y, rotation) {
        doc.save();
        doc.translate(x, y);
        doc.rotate(rotation);

        // Draw a decorative corner element
        doc.fillOpacity(1).strokeOpacity(1);
        doc.lineWidth(1.5);
        doc.fillAndStroke("#d4af37", "#0e8cc3");

        // Simple corner decoration
        doc
          .moveTo(0, 0)
          .lineTo(cornerSize, 0)
          .lineTo(cornerSize * 0.7, cornerSize * 0.7)
          .lineTo(0, cornerSize)
          .closePath()
          .fillAndStroke();

        // Add some detail
        doc
          .moveTo(cornerSize * 0.3, 0)
          .lineTo(cornerSize * 0.3, cornerSize * 0.3)
          .stroke();

        doc
          .moveTo(0, cornerSize * 0.3)
          .lineTo(cornerSize * 0.3, cornerSize * 0.3)
          .stroke();

        doc.restore();
      }

      // Draw the four corners
      drawCorner(cornerMargin, cornerMargin, 0);
      drawCorner(doc.page.width - cornerMargin, cornerMargin, 90);
      drawCorner(
        doc.page.width - cornerMargin,
        doc.page.height - cornerMargin,
        180
      );
      drawCorner(cornerMargin, doc.page.height - cornerMargin, 270);

      // Add logo/trophy image at the top center - smaller and higher
      try {
        const logoPath = path.join(__dirname, "../assets/logo.png");
        if (fs.existsSync(logoPath)) {
          const maxWidth = 100; // Even smaller logo
          const maxHeight = 50; // Even smaller logo

          // Add logo - moved higher
          doc.image(logoPath, doc.page.width / 2 - maxWidth / 2, 40, {
            fit: [maxWidth, maxHeight],
            align: "center",
          });
        } else {
          // console.log("Logo not found, skipping logo section");
        }
      } catch (error) {
        // console.log("Error adding logo, skipping logo section:", error.message);
      }

      // Add certificate title with decorative underline - even smaller and higher
      doc.moveDown(9); // Further reduced space
      doc
        .font("Nepali") // Use Nepali font for all text
        .fontSize(26) // Even smaller font
        .fill("#000000")
        .text("CERTIFICATE OF COMPLETION", {
          align: "center",
        });

      // Add decorative underline - simpler and smaller
      const titleWidth = doc.widthOfString("CERTIFICATE OF COMPLETION");
      const titleX = (doc.page.width - titleWidth) / 2;
      doc
        .moveTo(titleX, doc.y + 5)
        .lineTo(titleX + titleWidth, doc.y + 5)
        .lineWidth(2) // Thinner line
        .stroke("#0e8cc3");

      // Add decorative flourish
      const flourishWidth = 100;
      doc.moveTo(doc.page.width / 2 - flourishWidth / 2, doc.y + 15);

      // Course title section - more compact
      doc.moveDown(0.5);
      doc
        .font("Nepali") // Use Nepali font
        .fontSize(16) // Slightly smaller
        .fill("#444444")
        .text("Seep Mela 2082", {
          align: "center",
        });

      doc.moveDown(0.5); // Reduced space
      doc.font("Nepali").fontSize(14).fill("#333333").text("Presented to", {
        align: "center",
      });

      // Add recipient name with decorative elements - smaller font
      doc.moveDown(0.8); // Reduced space
      const recipientName = certificateDetail.traineeName;

      doc
        .font("Nepali") // Always use Nepali font
        .fontSize(24) // Reduced font size
        .fill("#000000");

      // Get width of name for decorative elements
      const nameWidth = doc.widthOfString(recipientName);
      const nameX = (doc.page.width - nameWidth) / 2;

      // Add decorative elements before name
      doc
        .moveTo(nameX - 30, doc.y + 14)
        .lineTo(nameX - 5, doc.y + 14)
        .lineWidth(1)
        .stroke("#d4af37");

      // Add the name
      doc.text(recipientName, {
        align: "center",
      });

      // Add decorative elements after name
      doc
        .moveTo(nameX + nameWidth + 5, doc.y - 14)
        .lineTo(nameX + nameWidth + 30, doc.y - 14)
        .lineWidth(1)
        .stroke("#d4af37");

      doc.moveDown(0.7);

      // Check if training type contains Nepali characters
      const trainingTypeNepali = /[\u0900-\u097F]/.test(
        certificateDetail.trainingType
      );

      doc
        .font(trainingTypeNepali ? "NepaliRegular" : "Helvetica")
        .fontSize(14) // Smaller font
        .fill("#333333")
        .text(
          `For Successfully Completing the "${certificateDetail.trainingType.toUpperCase()}" Course`,
          {
            align: "center",
          }
        );

      // Certificate details with improved styling - more compact
      doc.moveDown(0.7);

      // Create a subtle background for certificate details
      const detailsY = doc.y;
      const detailsHeight = 40; // Further reduced height

      // Certificate number and other details - smaller font
      doc
        .font("Nepali")
        .fontSize(13) // Smaller font
        .fill("#333333")
        .text(`Certificate No: ${certificateDetail.certificateNumber}`, {
          align: "center",
        });

      doc
        .font("Nepali")
        .fontSize(13) // Smaller font
        .fill("#333333")
        .text(
          `Issue Date: ${new Date(certificateDetail.issueDate)
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "/")}`,
          {
            align: "center",
          }
        );

      // Verification URL moved to the absolute bottom with tiny font
      // Position at the absolute bottom of the page with margin
      const urlY = doc.page.height - 45; // 25px from bottom (closer to bottom)

      // Add verification text with even smaller font
      doc
        .font("Nepali")
        .fontSize(7) // Even smaller font
        .fill("#333333")
        .text(
          `Verify at: https://kmc.seepmela.com/verify-certificate`,
          0, // x position (start from left)
          urlY, // y position (closer to bottom)
          {
            width: doc.page.width,
            align: "center",
          }
        );

      // Optionally add a QR code if you have a QR generation library
      // This is a placeholder - you would need to implement actual QR code generation

      // Add signatures with improved styling - absolute position from bottom
      const signatureHeight = doc.page.height - 150; // 150px from bottom
      doc.lineWidth(1);
      doc.fillAndStroke("#333333");
      doc.strokeOpacity(0.7); // More visible

      // Improved signature layout with three signatures - smaller
      const lineWidth = 140; // Even narrower signature lines

      // Instructor Signature (Center)
      const instructorX = doc.page.width / 2;
      // Add mayor signature if exists - smaller

      const instructorSignaturePath = path.join(
        __dirname,
        `../public/uploads/instructorimage/${instructorSignature}`
      );
      // console.log(instructorSignaturePath);
      if (fs.existsSync(instructorSignaturePath)) {
        doc.image(
          instructorSignaturePath,
          instructorX - 35,
          signatureHeight - 40,
          {
            width: 70,
            height: 25,
          }
        );
      }

      // Creates a line for Instructor signature with decorative ends
      doc
        .moveTo(instructorX - 70, signatureHeight)
        .lineTo(instructorX + 70, signatureHeight)
        .stroke();

      // Instructor info with improved styling
      doc
        .font("Nepali")
        .fontSize(12)
        .fill("#333333")
        .text("Instructor", instructorX - lineWidth / 2, signatureHeight + 10, {
          width: lineWidth,
          align: "center",
        });

      doc
        .font("Nepali")
        .fontSize(14)
        .fill("#000000") // Darker color for better visibility
        .text(
          certificateDetail.trainerName,
          instructorX - lineWidth / 2,
          signatureHeight + 30,
          {
            width: lineWidth,
            align: "center",
          }
        );

      // Mayor Signature (Left side)
      const mayorX = doc.page.width / 6;

      // Add mayor signature if exists - smaller
      const mayorSignaturePath = path.join(
        __dirname,
        `../uploads/mayor/${mayorDetails.mayorSignature}`
      );
      if (fs.existsSync(mayorSignaturePath)) {
        doc.image(mayorSignaturePath, mayorX - 35, signatureHeight - 40, {
          width: 70,
          height: 25,
        });
      }

      // Creates a line for Mayor signature with decorative ends
      doc
        .moveTo(mayorX - 70, signatureHeight)
        .lineTo(mayorX + 70, signatureHeight)
        .stroke();

      // Mayor info with improved styling
      doc
        .font("Nepali")
        .fontSize(12)
        .fill("#333333")
        .text("Mayor", mayorX - lineWidth / 2, signatureHeight + 10, {
          width: lineWidth,
          align: "center",
        });

      doc
        .font("Nepali")
        .fontSize(14)
        .fill("#000000") // Darker color for better visibility
        .text(
          mayorDetails.mayorName,
          mayorX - lineWidth / 2,
          signatureHeight + 30,
          {
            width: lineWidth,
            align: "center",
          }
        );

      // Deputy Mayor Signature (Right side)
      const deputyX = (doc.page.width * 5) / 6;

      // Add deputy mayor signature if exists - smaller
      const deputyMayorPath = path.join(
        __dirname,
        `../uploads/mayor/${mayorDetails.deputyMayorSignature}`
      );
      if (fs.existsSync(deputyMayorPath)) {
        doc.image(deputyMayorPath, deputyX - 35, signatureHeight - 40, {
          width: 70,
          height: 25,
        });
      }

      // Creates a line for Deputy Mayor signature with decorative ends
      doc
        .moveTo(deputyX - 70, signatureHeight)
        .lineTo(deputyX + 70, signatureHeight)
        .stroke();

      // Deputy Mayor info with improved styling
      doc
        .font("Nepali")
        .fontSize(12)
        .fill("#333333")
        .text("Deputy Mayor", deputyX - lineWidth / 2, signatureHeight + 10, {
          width: lineWidth,
          align: "center",
        });

      doc
        .font("Nepali")
        .fontSize(14)
        .fill("#000000") // Darker color for better visibility
        .text(
          mayorDetails.deputyMayorName,
          deputyX - lineWidth / 2,
          signatureHeight + 30,
          {
            width: lineWidth,
            align: "center",
          }
        );

      // Nepal skyline watermark at the bottom - more compact
      doc.save();
      doc.restore();

      stream.on("finish", () => {
        resolve(outputFilePath);
      });

      stream.on("error", (err) => {
        reject(err);
      });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
exports.createCertificate = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Find the user to populate certificate data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the certificate document (there should be only one as per your schema)
    let certificateDoc = await Certificate.findOne();
    if (!certificateDoc) {
      return res.status(404).json({
        error:
          "Certificate template not found. Please set up mayor details first.",
      });
    }

    const certificateNumber = `KMC-SEEP-${user.sectorOfInterest
      .replace("/", "")
      .toUpperCase()}-${user.applicantId.replace(/^KMC/, "")}`;

    // Find the trainer for this sector
    const trainer = await Instructor.findOne({
      expertise: user.sectorOfInterest,
    });

    if (!trainer) {
      return res
        .status(404)
        .json({ error: "Trainer not found for this sector of interest" });
    }

    // Create new certificate details
    const newCertificateDetail = {
      traineeId: userId,
      traineeName: user.fullName || "Default Name",
      trainerName: trainer.fullName || "Default Trainer",
      trainingType: user.sectorOfInterest || "Default Training",
      issueDate: new Date(),
      certificateNumber,
    };

    // Check if certificate already exists
    const existingIndex = certificateDoc.certificateDetails.findIndex(
      (detail) => detail.certificateNumber === certificateNumber
    );

    // Delete the old certificate file if it exists
    if (existingIndex !== -1) {
      try {
        const certificatesDir = path.join(__dirname, "../uploads/certificates");

        // Read directory contents
        const files = fs.readdirSync(certificatesDir);

        // Look for files that match the pattern: certificate-{certificateNumber}.pdf
        for (const file of files) {
          // Check if file matches the expected pattern
          if (file === `certificate-${certificateNumber}.pdf`) {
            const filePath = path.join(certificatesDir, file);

            try {
              fs.unlinkSync(filePath);
            } catch (deleteError) {
              console.error(`Failed to delete ${file}:`, deleteError);
            }
          }
        }
      } catch (fileError) {
        console.error("Error deleting old certificate file:", fileError);
        // Continue even if file deletion fails
      }

      // Replace the existing certificate with the new one
      certificateDoc.certificateDetails[existingIndex] = newCertificateDetail;
    }

    // Save the updated document
    await certificateDoc.save();

    // Get instructor signature
    const instructorSignature = trainer.instructorSignature;

    // Generate PDF certificate
    const outputPath = path.join(__dirname, "../uploads/certificates");
    const pdfPath = await generateCertificatePDF(
      newCertificateDetail,
      certificateDoc.mayorDetails,
      instructorSignature,
      outputPath
    );

    // Get the relative URL path for the certificate
    const relativePdfPath = pdfPath.replace(
      path.join(__dirname, "../uploads/certificates"),
      `${process.env.BASE_URL}/uploads/certificates`
    );

    //different messages based on if it already exists or not
    return res.status(200).json({
      message:
        existingIndex !== -1
          ? "Certificate updated successfully"
          : "Certificate created successfully",
      certificate: newCertificateDetail,
      pdfUrl: relativePdfPath,
    });
  } catch (error) {
    console.error("CreateCertificate Error:", error);
    return res
      .status(500)
      .json({ error: "Server error creating certificate." });
  }
};
exports.verifyCertificate = async (req, res) => {
  try {
    const { certificateNumber } = req.params;

    let certificate = await Certificate.findOne({
      "certificateDetails.certificateNumber": certificateNumber,
    });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found.",
      });
    }

    const matchingCertificate = certificate.certificateDetails.find(
      (cert) => cert.certificateNumber === certificateNumber
    );

    return res.status(200).json({
      success: true,
      message: "Certificate verified successfully.",
      certificate: {
        ...matchingCertificate.toObject(),
      },
    });
  } catch (error) {
    console.error("verifyCertificate Error:", error);
    return res
      .status(500)
      .json({ error: "Server error verifying certificate." });
  }
};

exports.updateMayorDetails = async (req, res) => {
  try {
    let page = await Certificate.findOne();
    if (!page) {
      // Create a new document with mayorDetails properly initialized
      page = new Certificate({
        mayorDetails: {
          mayorName: "",
          mayorSignature: "",
          deputyMayorName: "",
          deputyMayorSignature: "",
        },
      });
    } else if (!page.mayorDetails) {
      // If page exists but mayorDetails is undefined, initialize it
      page.mayorDetails = {
        mayorName: "",
        mayorSignature: "",
        deputyMayorName: "",
        deputyMayorSignature: "",
      };
    }

    const { mayorName, deputyMayorName } = req.body;

    // Update text fields if provided
    if (mayorName !== undefined) page.mayorDetails.mayorName = mayorName;
    if (deputyMayorName !== undefined)
      page.mayorDetails.deputyMayorName = deputyMayorName;

    // Handle file uploads and deletions
    if (req.files) {
      const uploadPath = path.join(__dirname, "../uploads/mayor");

      // Handle mayor signature
      if (req.files.mayorSignature) {
        // Delete old file if it exists
        if (page.mayorDetails.mayorSignature) {
          const oldFilePath = path.join(
            uploadPath,
            page.mayorDetails.mayorSignature
          );
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        page.mayorDetails.mayorSignature = req.files.mayorSignature[0].filename;
      }

      // Handle deputy mayor signature
      if (req.files.deputyMayorSignature) {
        // Delete old file if it exists
        if (page.mayorDetails.deputyMayorSignature) {
          const oldFilePath = path.join(
            uploadPath,
            page.mayorDetails.deputyMayorSignature
          );
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        page.mayorDetails.deputyMayorSignature =
          req.files.deputyMayorSignature[0].filename;
      }
    }

    // Save the updated document
    await page.save();

    return res.status(201).json({
      message: "Mayor Details Updated",
      mayor: page.mayorDetails,
    });
  } catch (error) {
    console.error("UpdateMayorDetails Error:", error);
    return res
      .status(500)
      .json({ error: "Server error updating mayor details." });
  }
};

exports.getMayorDetails = async (req, res) => {
  try {
    const page = await Certificate.findOne();

    return res.status(200).json({
      message: "Mayor Details Fetched",
      mayor: page.mayorDetails,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching mayor details",
      error: error.message,
    });
  }
};
