const express = require("express");
const router = express.Router();
const blogController = require("../controller/blogController");
const authMiddleware = require("../middleware/routesAuth");

// Public endpoint to get
router.get("/", blogController.getBlogPage);

// Admin-only: update page-level info (page title and subtitle)
router.post("/", authMiddleware, blogController.updateBlogPage);

// Admin-only: add a new blog item (with image upload)
router.post(
  "/items",
  authMiddleware,
  blogController.uploadBlogImageMiddleware,
  blogController.addBlogItem
);

// Admin-only: update an existing blog item (optionally with image upload)
router.patch(
  "/items/:blogId",
  authMiddleware,
  blogController.uploadBlogImageMiddleware,
  blogController.updateBlogItem
);

// Admin-only: delete a blog item
router.delete("/items/:blogId", authMiddleware, blogController.deleteBlogItem);

module.exports = router;
