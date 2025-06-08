const createUploader = require("../middleware/uploader");
const fs = require("fs").promises;
const path = require("path");
const BlogPage = require("../models/blogs");

// Multer instance for blog Images
const blogUploader = createUploader("blogs").single("blogImage");

// Middleware wrapper for file uploads
exports.uploadBlogImageMiddleware = (req, res, next) => {
  blogUploader(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

/**
 * GET /api/blogs?lang=en|np
 * Public: Returns the BlogPage document with language-specific content
 * Default language is English if not specified
 */
exports.getBlogPage = async (req, res) => {
  try {
    const { lang = "en" } = req.query;

    let page = await BlogPage.findOne();
    if (!page) {
      page = new BlogPage();
      await page.save();
    }

    // Create response object based on language
    let response;
    if (lang === "np") {
      response = {
        _id: page._id,
        pageTitle: page.npPageTitle,
        pageSubtitle: page.npPageSubtitle,
        blogs: page.blogs.map((blog) => ({
          _id: blog._id,
          title: blog.npTitle,
          description: blog.npDescription,
          fullContent: blog.npFullContent,
          Image: blog.Image,
          postedBy: blog.postedBy,
          postedAt: blog.postedAt,
        })),
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      };
    } else {
      response = {
        _id: page._id,
        pageTitle: page.enPageTitle,
        pageSubtitle: page.enPageSubtitle,
        blogs: page.blogs.map((blog) => ({
          _id: blog._id,
          title: blog.enTitle,
          description: blog.enDescription,
          fullContent: blog.enFullContent,
          Image: blog.Image,
          postedBy: blog.postedBy,
          postedAt: blog.postedAt,
        })),
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("getBlogPage Error:", error);
    return res.status(500).json({ error: "Server error fetching blog page." });
  }
};

/**
 * POST /api/blogs
 * Admin Only: Update page-level info for both languages
 * Expects: { enPageTitle, enPageSubtitle, npPageTitle, npPageSubtitle }
 */
exports.updateBlogPage = async (req, res) => {
  try {
    const { enPageTitle, enPageSubtitle, npPageTitle, npPageSubtitle } =
      req.body;

    let page = await BlogPage.findOne();
    if (!page) {
      page = new BlogPage();
    }

    // Update English fields
    if (enPageTitle !== undefined) page.enPageTitle = enPageTitle;
    if (enPageSubtitle !== undefined) page.enPageSubtitle = enPageSubtitle;

    // Update Nepali fields
    if (npPageTitle !== undefined) page.npPageTitle = npPageTitle;
    if (npPageSubtitle !== undefined) page.npPageSubtitle = npPageSubtitle;

    await page.save();
    return res.status(200).json({
      message: "Blog page updated successfully.",
      page,
    });
  } catch (error) {
    console.error("updateBlogPage Error:", error);
    return res.status(500).json({ error: "Server error updating blog page." });
  }
};

/**
 * POST /api/blogs/items
 * Admin Only: Add a new blog item in both languages
 * Expects form-data with fields: enTitle, enDescription, enFullContent, npTitle, npDescription, npFullContent, postedBy, and file field "blogImage"
 */
exports.addBlogItem = async (req, res) => {
  try {
    const {
      enTitle,
      enDescription,
      enFullContent,
      npTitle,
      npDescription,
      npFullContent,
      postedBy,
    } = req.body;

    // Validate required fields
    if (!enTitle || !npTitle) {
      return res.status(400).json({
        error:
          "Both English title (enTitle) and Nepali title (npTitle) are required.",
      });
    }

    let page = await BlogPage.findOne();
    if (!page) {
      page = new BlogPage();
      await page.save();
    }

    let imageName = "";
    if (req.file) {
      imageName = req.file.filename;
    }

    page.blogs.push({
      enTitle,
      enDescription: enDescription || "",
      enFullContent: enFullContent || "",
      npTitle,
      npDescription: npDescription || "",
      npFullContent: npFullContent || "",
      Image: imageName,
      postedBy: postedBy || "Admin",
    });

    await page.save();
    return res.status(201).json({
      message: "Blog item added successfully.",
      page,
    });
    
  } catch (error) {
    console.error("addBlogItem Error:", error);
    return res.status(500).json({ error: "Server error adding blog item." });
  }
};

/**
 * Helper function to safely delete a file
 */
const deleteFile = async (filePath) => {
  try {
    if (filePath) {
      // Check if file exists before trying to delete
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`File deleted successfully: ${filePath}`);
    }
  } catch (error) {
    // File doesn't exist or other error - log but don't throw
    console.log(`Could not delete file ${filePath}:`, error.message);
  }
};

/**
 * PUT /api/blogs/items/:blogId
 * Admin Only: Update a specific blog item in both languages
 * Expects form-data with fields: enTitle, enDescription, enFullContent, npTitle, npDescription, npFullContent, postedBy, and optional file field "blogImage"
 */
exports.updateBlogItem = async (req, res) => {
  try {
    const { blogId } = req.params;
    const {
      enTitle,
      enDescription,
      enFullContent,
      npTitle,
      npDescription,
      npFullContent,
      postedBy,
    } = req.body;
    let page = await BlogPage.findOne();
    if (!page) {
      return res.status(404).json({ error: "Blog page not found." });
    }

    const item = page.blogs.id(blogId);
    if (!item) {
      return res.status(404).json({ error: "Blog item not found." });
    }

    // Store old Image path for cleanup if a new Image is uploaded
    const oldImagePath = item.Image;

    // Update English fields
    if (enTitle !== undefined) item.enTitle = enTitle;
    if (enDescription !== undefined) item.enDescription = enDescription;
    if (enFullContent !== undefined) item.enFullContent = enFullContent;

    // Update Nepali fields
    if (npTitle !== undefined) item.npTitle = npTitle;
    if (npDescription !== undefined) item.npDescription = npDescription;
    if (npFullContent !== undefined) item.npFullContent = npFullContent;

    // Update common fields
    if (postedBy !== undefined) item.postedBy = postedBy;

    // Handle Image update
    if (req.file) {
      item.Image = req.file.filename;

      // Delete old Image if it exists and is different from new one
      if (oldImagePath && oldImagePath !== req.file.filename) {
        const oldImageFullPath = path.join("uploads", "blogs", oldImagePath);
        await deleteFile(oldImageFullPath);
      }
    }

    await page.save();
    return res.status(200).json({
      message: "Blog item updated successfully.",
      page,
    });
  } catch (error) {
    console.error("updateBlogItem Error:", error);

    // If there was an error and a new file was uploaded, clean it up
    if (req.file) {
      const newImagePath = path.join("uploads", "blogs", req.file.filename);
      await deleteFile(newImagePath);
    }

    return res.status(500).json({ error: "Server error updating blog item." });
  }
};

/**
 * GET /api/blogs/items/:blogId?lang=en|np
 * Public: Get a specific blog item with language support
 */
exports.getBlogItem = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { lang = "en" } = req.query;

    let page = await BlogPage.findOne();
    if (!page) {
      return res.status(404).json({ error: "Blog page not found." });
    }

    const item = page.blogs.id(blogId);
    if (!item) {
      return res.status(404).json({ error: "Blog item not found." });
    }

    // Return language-specific content
    let response;
    if (lang === "np") {
      response = {
        _id: item._id,
        title: item.npTitle,
        description: item.npDescription,
        fullContent: item.npFullContent,
        Image: item.Image,
        postedBy: item.postedBy,
        postedAt: item.postedAt,
      };
    } else {
      response = {
        _id: item._id,
        title: item.enTitle,
        description: item.enDescription,
        fullContent: item.enFullContent,
        Image: item.Image,
        postedBy: item.postedBy,
        postedAt: item.postedAt,
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("getBlogItem Error:", error);
    return res.status(500).json({ error: "Server error fetching blog item." });
  }
};

/**
 * DELETE /api/blogs/items/:blogId
 * Admin Only: Remove a blog item from the array.
 */
exports.deleteBlogItem = async (req, res) => {
  try {
    const { blogId } = req.params;
    let page = await BlogPage.findOne();
    if (!page) {
      return res.status(404).json({ error: "Blog page not found." });
    }

    const item = page.blogs.id(blogId);
    if (!item) {
      return res.status(404).json({ error: "Blog item not found." });
    }

    // Store Image path before removing the item
    const ImagePath = item.Image;

    // Remove the subdocument
    page.blogs.pull(blogId);
    await page.save();

    // Delete associated Image file
    if (ImagePath) {
      const fullImagePath = path.join("uploads", "blogs", ImagePath);
      await deleteFile(fullImagePath);
    }

    return res.status(200).json({
      message: "Blog item deleted successfully.",
      page,
    });
  } catch (error) {
    console.error("deleteBlogItem Error:", error);
    return res.status(500).json({ error: "Server error deleting blog item." });
  }
};
