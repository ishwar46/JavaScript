const HeroSection = require("../models/herosection");
const upload = require("../middleware/multipledocs");
const fs = require("fs");
const path = require("path");

// Create a new HeroSection
exports.createHeroSection = [
  upload,
  async (req, res) => {
    try {
    
      const imagePaths = req.files && req.files.venueimage
        ? req.files.venueimage.slice(0, maxImages).map(file => file.path)
        : [];

      // Clean up excess images
      if (req.files && req.files.venueimage && req.files.venueimage.length > maxImages) {
        req.files.venueimage.slice(maxImages).forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      // Check for variations of dateRange
      const dateRange = req.body.dateRange || req.body.date_range || req.body.daterange || "";

      const heroSection = new HeroSection({
        dateRange: req.body.dateRange,
        title: req.body.title || "",
        slogan: req.body.slogan || "",
        eventDuration: req.body.eventDuration || "",
        location: req.body.location || "",
        participants: req.body.participants ? parseInt(req.body.participants) : 0,
       // visitors: req.body.visitors ? parseInt(req.body.visitors) : 0,
        registerNow: req.body.registerNow || "",
        viewSchedule: req.body.viewSchedule || "",
        ImageArray: imagePaths,
      });

      await heroSection.save();

      res.status(201).json({
        message: "HeroSection created successfully",
        heroSection: heroSection.toObject(),
      });
    } catch (error) {
      if (error.code === "LIMIT_UNEXPECTED_FILE") {
      }
      res.status(400).json({ message: "Error creating HeroSection", error: error.message });
    }
  },
];

// Update a HeroSection by ID
exports.updateHeroSection = [
  upload,
  async (req, res) => {
    try {
    
      const heroSection = await HeroSection.findById(req.params.id);
      if (!heroSection) {
        return res.status(404).json({ message: "HeroSection not found" });
      }

      const dateRange = req.body.dateRange || req.body.date_range || req.body.daterange || heroSection.dateRange;

      heroSection.dateRange = dateRange;
      heroSection.title = req.body.title || heroSection.title;
      heroSection.slogan = req.body.slogan || heroSection.slogan;
      heroSection.eventDuration = req.body.eventDuration || heroSection.eventDuration;
      heroSection.location = req.body.location || heroSection.location;
      heroSection.participants = req.body.participants
        ? parseInt(req.body.participants)
        : heroSection.participants;
      heroSection.visitors = req.body.visitors
        ? parseInt(req.body.visitors)
        : heroSection.visitors;
      heroSection.registerNow = req.body.registerNow || heroSection.registerNow;
      heroSection.viewSchedule = req.body.viewSchedule || heroSection.viewSchedule;

      if (req.files && req.files.venueimage && req.files.venueimage.length > 0) {
        const maxImages = 4;
        heroSection.ImageArray.forEach((imagePath) => {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        });
        heroSection.ImageArray = req.files.venueimage.slice(0, maxImages).map(file => file.path);

        if (req.files.venueimage.length > maxImages) {
          req.files.venueimage.slice(maxImages).forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }
      }

      await heroSection.save();

      res.status(200).json({
        message: "HeroSection updated successfully",
        heroSection: heroSection.toObject(),
      });
    } catch (error) {
      if (error.code === "LIMIT_UNEXPECTED_FILE") {
      }
      res.status(400).json({ message: "Error updating HeroSection", error: error.message });
    }
  },
];

// Get all HeroSections
exports.getAllHeroSections = async (req, res) => {
  try {
    const heroSections = await HeroSection.find();
    res.status(200).json(heroSections);
  } catch (error) {
    res.status(500).json({ message: "Error fetching HeroSections", error: error.message });
  }
};

// Get a HeroSection by ID
exports.getHeroSectionById = async (req, res) => {
  try {
    const heroSection = await HeroSection.findById(req.params.id);
    if (!heroSection) {
      return res.status(404).json({ message: "HeroSection not found" });
    }
    res.status(200).json(heroSection);
  } catch (error) {
    res.status(500).json({ message: "Error fetching HeroSection", error: error.message });
  }
};

// Delete a HeroSection
exports.deleteHeroSection = async (req, res) => {
  try {
    const heroSection = await HeroSection.findById(req.params.id);
    if (!heroSection) {
      return res.status(404).json({ message: "HeroSection not found" });
    }

    heroSection.ImageArray.forEach((imagePath) => {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

    await heroSection.deleteOne();
    res.status(200).json({ message: "HeroSection deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting HeroSection", error: error.message });
  }
};