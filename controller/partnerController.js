const createUploader = require("../middleware/uploader.js");
const Partner = require("../models/partner.js");

const partnerLogoUploader = createUploader("partners").fields([
  { name: "partnerLogo", maxCount: 1 },
]);
// Middleware wrapper for file uploads
exports.uploadPartnerLogoMiddleware = (req, res, next) => {
  partnerLogoUploader(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

/**
 * GET /api/getAllPartners, admin
 */
exports.getAllPartners = async (req, res) => {
  try {
    let allPartners = await Partner.find();
    if (!allPartners) {
      allPartners = new Partner();
      await allPartners.save();
    }
    return res.status(200).json({
      success: true,
      allPartners,
      message: "All Approved Partners Fetched Successfully",
    });
  } catch (error) {
    console.error("geAllPartner Error:", error);
    return res.status(500).json({ error: "Server error fetching partner." });
  }
};
/**
 * GET /api/getAllPartners, public
 */
exports.getAllApprovedPartners = async (req, res) => {
  try {
    let allPartners = await Partner.find({ approved: true });
    if (!allPartners) {
      allPartners = new Partner();
      await allPartners.save();
    }
    return res.status(200).json({
      success: true,
      allPartners,
      message: "All Approved Partners Fetched Successfully",
    });
  } catch (error) {
    console.error("geAllPartner Error:", error);
    return res.status(500).json({ error: "Server error fetching partner." });
  }
};

/**
 * POST /api/add-partners, public
 */
exports.registerPartner = async (req, res) => {
  try {
    const { name, description, address, partnerType } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required." });
    }

    if (!req.files.partnerLogo) {
      return res.status(400).json({ error: "partnerLogo is required." });
    }
    const partnerLogo = req.files.partnerLogo[0].filename;

    const partner = new Partner({
      name: name,
      partnerLogo: partnerLogo,
      description: description,
      approved: false,
      address: address,
      partnerType: partnerType,
    });

    await partner.save();
    return res.status(201).json({
      message: "Partner registered successfully.",
      partner,
    });
  } catch (error) {
    console.error("registerPartner Error:", error);
    return res.status(500).json({ error: "Server error registering partner." });
  }
};
/**
 * POST /api/add-partners, admin only
 */
exports.addPartner = async (req, res) => {
  try {
    const { name, description, address, partnerType } = req.body;
    if (!name || !partnerType) {
      return res
        .status(400)
        .json({ error: "name and partnerType are required." });
    }

    if (!req.files.partnerLogo) {
      return res.status(400).json({ error: "partnerLogo is required." });
    }
    const partnerLogo = req.files.partnerLogo[0].filename;

    const partner = new Partner({
      name: name,
      partnerLogo: partnerLogo,
      description: description,
      approved: true,
      address: address,
      partnerType: partnerType,
    });

    await partner.save();
    return res.status(201).json({
      message: "Partner added successfully.",
      partner,
    });
  } catch (error) {
    console.error("addPartner Error:", error);
    return res.status(500).json({ error: "Server error adding partner." });
  }
};
/**
 * Patch /api/update-partner/:partnerId, admin
 */
exports.updatePartner = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { name, description, address, partnerType } = req.body;

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found." });
    }
    partner.name = name || partner.name;
    partner.description = description || partner.description;
    partner.address = address || partner.address;
    partner.partnerType = partnerType || partner.partnerType;
    if (req.files.partnerLogo) {
      partner.partnerLogo = req.files.partnerLogo[0].filename;
    }
    await partner.save();
    return res.status(201).json({
      message: `Partner updated successfully.`,
      partner,
    });
  } catch (error) {
    console.error("updatePartner Error:", error);
    return res.status(500).json({ error: "Server error updating partner." });
  }
};
/**
 * Patch /api/delete-partner/:partnerId, admin
 */
exports.deletePartner = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const partner = await Partner.findByIdAndDelete(partnerId);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found." });
    }

    return res.status(201).json({
      message: `Partner deleted successfully.`,
    });
  } catch (error) {
    console.error("deletePartner Error:", error);
    return res.status(500).json({ error: "Server error deleting partner." });
  }
};
/**
 * Patch /api/verify-partner/:partnerId, admin
 */
exports.verifyPartner = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { approved } = req.body;

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found." });
    }
    partner.approved = approved;

    await partner.save();
    return res.status(201).json({
      message: `Partner status successfully set to ${
        approved === "true" ? "Approved" : "Not Approved"
      }.`,
      partner,
    });
  } catch (error) {
    console.error("verifyPartner Error:", error);
    return res.status(500).json({ error: "Server error verifying partner." });
  }
};
