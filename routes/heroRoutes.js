const express = require("express");
const router = express.Router();
const heroSectionController = require("../controller/heroController");

router.post("/", heroSectionController.createHeroSection);
router.get("/", heroSectionController.getAllHeroSections);
router.get("/:id", heroSectionController.getHeroSectionById);
router.put("/:id", heroSectionController.updateHeroSection);
router.delete("/:id", heroSectionController.deleteHeroSection);

module.exports = router;