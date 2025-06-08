const axios = require("axios");
const BulkSmsLog = require("../models/bulkSmsLogs");

const BASE_URL = process.env.DOIT_SMS_BASE_URL || "https://sms.doit.gov.np/api/sms";
const TOKEN = process.env.DOIT_SMS_TOKEN;

/**
 * Send bulk SMS to multiple mobile numbers (comma-separated)
 * @param {Object} params - The SMS parameters
 * @param {string} params.mobile - Comma-separated list of mobile numbers
 * @param {string} params.message - SMS content
 * @param {Object} [params.user] - User who sent the SMS (for logging)
 * @returns {Promise<Object>} Response from DoIT SMS API
 */
const sendBulkSMS = async ({ mobile, message, user = null }) => {
    if (!TOKEN) {
        throw new Error("DOIT_SMS_TOKEN is not set in environment variables.");
    }

    try {
        const response = await axios.post(
            BASE_URL,
            { mobile, message },
            {
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                timeout: 15000,
            }
        );

        console.log("Bulk SMS sent via DoIT:", response.data);

        // Log successful SMS
        try {
            await BulkSmsLog.create({
                mobile,
                message,
                status: "success",
                sentBy: user?._id,
                responseData: response.data,
            });
        } catch (logError) {
            console.error("Error logging successful bulk SMS:", logError);
            // Continue even if logging fails
        }

        return response.data;
    } catch (error) {
        const details =
            error.response?.data || error.response?.statusText || error.message;
        console.error("Error sending bulk SMS via DoIT:", details);

        // Log failed SMS
        try {
            await BulkSmsLog.create({
                mobile,
                message,
                status: "failed",
                error: JSON.stringify(details),
                sentBy: user?._id,
                responseData: error.response?.data || null,
            });
        } catch (logError) {
            console.error("Error logging failed bulk SMS:", logError);
            // Continue even if logging fails
        }

        throw error;
    }
};

module.exports = { sendBulkSMS };