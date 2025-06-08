const { bulkEmailTemplate } = require("../emailTemplates/EmailTemplates");
const Subscription = require("../models/subscription");
const { sendEmailInBulk } = require("../utils/nodeMailer");

// Controller function to add a new subscription (email only)
const addSubscription = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email already subscribed
    const existingSubscription = await Subscription.findOne({ email });
    if (existingSubscription) {
      return res.status(400).json({ error: "Email already subscribed" });
    }

    // Save new subscription
    const newSubscription = new Subscription({ email });
    await newSubscription.save();

    return res.status(200).json({
      success: true,
      message: "Subscribed successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to add subscription" });
  }
};

// Controller function to get all subscriptions
// const getAllSubscriptions = async (req, res) => {
//   try {
//     const subscriptions = await Subscription.find();
//     res.status(200).json({ subscriptions });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to get subscriptions" });
//   }
// };

const getAllSubscriptions = async (req, res) => {
  try {
    // Extract query parameters with defaults
    const { page = 1, limit = 10, search = "" } = req.query;

    // Convert page and limit to numbers and validate
    const pageNumber = Math.max(1, parseInt(page, 10)); // Ensure page is at least 1
    const limitNumber = Math.max(1, parseInt(limit, 10)); // Ensure limit is at least 1

    // Build query for search (case-insensitive email search)
    const query = search ? { email: { $regex: search, $options: "i" } } : {};

    // Get total number of matching subscribers
    const totalSubscribers = await Subscription.countDocuments(query);

    // Fetch paginated subscribers, sorted by timestamp (newest first)
    const subscriptions = await Subscription.find(query)
      .sort({ timestamp: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Calculate total pages
    const totalPages = Math.ceil(totalSubscribers / limitNumber) || 1; // Ensure at least 1 page

    // Send response
    res.status(200).json({
      success: true,
      subscriptions,
      totalSubscribers,
      totalPages,
      currentPage: pageNumber,
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error); // Log error for debugging
    res.status(500).json({ error: "Failed to get subscriptions" });
  }
};
const sendBulkEmail = async (req, res) => {
  try {
    const { title, subject, body } = req.body;

    const subscriptions = await Subscription.find();
    const emails = subscriptions.map((subscription) => subscription.email);

    // Send emails in bulk using a loop or Promise.all
    // console.log(req.body);
    await Promise.all(
      emails.map((email) =>
        sendEmailInBulk({
          from: "tiu.kmc@gmail.com",
          to: email,
          subject,
          html: bulkEmailTemplate(title, body),
        })
      )
    );

    res.status(200).json({
      success: true,
      message: "Bulk mail sent successfully",
    });
  } catch (error) {
    console.error("Error sending bulk email:", error);
    res.status(500).json({ error: "Failed to send bulk email" });
  }
};

module.exports = { addSubscription, getAllSubscriptions, sendBulkEmail };
