const mongoose = require("mongoose");

const bulkSmsLogSchema = new mongoose.Schema(
    {
        mobile: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["success", "failed"],
            required: true,
        },
        error: {
            type: String,
            default: null,
        },
        responseData: {
            type: Object,
            default: null,
        },
        sentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("BulkSmsLog", bulkSmsLogSchema);