const { sendBulkSMS } = require("../utils/bulkSmsSender");
const BulkSmsLog = require("../models/bulkSmsLogs");

/**
 * Send bulk SMS to multiple mobile numbers
 * @route POST /api/bulk-sms/send
 */
const sendBulkSMSMessage = async (req, res) => {
    try {
        const { mobile, message } = req.body;

        if (!mobile || !message) {
            return res.status(400).json({
                success: false,
                message: "Mobile numbers and message are required."
            });
        }

        const response = await sendBulkSMS({
            mobile,
            message,
            user: req.user
        });

        return res.status(200).json({
            success: true,
            message: "Bulk SMS sent successfully",
            response
        });
    } catch (error) {
        console.error("Error sending bulk SMS:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send bulk SMS",
            error: error.message
        });
    }
};

/**
 * Get bulk SMS logs with pagination and filtering
 * @route GET /api/bulk-sms/logs
 */
const getBulkSMSLogs = async (req, res) => {
    try {
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Filters
        const query = {};

        if (req.query.status) {
            query.status = req.query.status;
        }

        if (req.query.mobile) {
            query.mobile = { $regex: req.query.mobile, $options: "i" };
        }

        // Date range
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};

            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }

            if (req.query.endDate) {
                const endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        // Get logs with pagination
        const logs = await BulkSmsLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sentBy", "personalInformation.fullName.firstName personalInformation.fullName.lastName");

        // Count total logs for pagination
        const total = await BulkSmsLog.countDocuments(query);

        // Get metrics
        const successCount = await BulkSmsLog.countDocuments({ ...query, status: "success" });
        const failedCount = await BulkSmsLog.countDocuments({ ...query, status: "failed" });

        return res.status(200).json({
            success: true,
            logs,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            },
            metrics: {
                total,
                success: successCount,
                failed: failedCount,
                successRate: total > 0 ? ((successCount / total) * 100).toFixed(2) + "%" : "0%"
            }
        });
    } catch (error) {
        console.error("Error fetching bulk SMS logs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch bulk SMS logs",
            error: error.message
        });
    }
};

module.exports = {
    sendBulkSMSMessage,
    getBulkSMSLogs
};