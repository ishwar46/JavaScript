const LoginLog = require("../models/loginlog");

// Get all login logs with pagination and filtering
const getLoginLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'timestamp',
            sortOrder = 'desc',
            email = '',
            userId = '',
            startDate = '',
            endDate = '',
            isSuccess = '',
        } = req.query;

        // Build filter object
        const filter = {};

        if (email) {
            filter.email = { $regex: email, $options: 'i' };
        }

        if (userId) {
            filter.userId = userId;
        }

        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                filter.timestamp.$lte = endDateTime;
            }
        }

        // Success/failure filter
        if (isSuccess !== '') {
            filter.isSuccess = isSuccess === 'true';
        }

        // Calculate pagination values
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Set up sort configuration
        const sortConfig = {};
        sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute queries with Promise.all for efficiency
        const [logs, total] = await Promise.all([
            LoginLog.find(filter)
                .sort(sortConfig)
                .skip(skip)
                .limit(limitNum)
                .populate('userId', 'fullName email mobileNumber role')
                .lean(),
            LoginLog.countDocuments(filter)
        ]);

        // Calculate pagination metadata
        const totalPages = Math.ceil(total / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        return res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages,
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (error) {
        console.error('Error fetching login logs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch login logs',
            error: error.message
        });
    }
};

// Get login logs summary (counts by success/failure, recent activity)
const getLoginLogsSummary = async (req, res) => {
    try {
        // Get counts for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Execute queries with Promise.all for efficiency
        const [
            totalLogs,
            successfulLogins,
            failedLogins,
            todayLogins,
            todaySuccessful,
            todayFailed,
            recentLogs
        ] = await Promise.all([
            LoginLog.countDocuments({}),
            LoginLog.countDocuments({ isSuccess: true }),
            LoginLog.countDocuments({ isSuccess: false }),
            LoginLog.countDocuments({ timestamp: { $gte: today, $lt: tomorrow } }),
            LoginLog.countDocuments({ isSuccess: true, timestamp: { $gte: today, $lt: tomorrow } }),
            LoginLog.countDocuments({ isSuccess: false, timestamp: { $gte: today, $lt: tomorrow } }),
            LoginLog.find({})
                .sort({ timestamp: -1 })
                .limit(5)
                .populate('userId', 'fullName email mobileNumber role')
                .lean()
        ]);

        // Get statistics by day for the last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dateStr = date.toISOString().split('T')[0];

            const [dayTotal, daySuccessful, dayFailed] = await Promise.all([
                LoginLog.countDocuments({ timestamp: { $gte: date, $lt: nextDay } }),
                LoginLog.countDocuments({ isSuccess: true, timestamp: { $gte: date, $lt: nextDay } }),
                LoginLog.countDocuments({ isSuccess: false, timestamp: { $gte: date, $lt: nextDay } })
            ]);

            last7Days.push({
                date: dateStr,
                total: dayTotal,
                successful: daySuccessful,
                failed: dayFailed
            });
        }

        return res.status(200).json({
            success: true,
            summary: {
                total: {
                    all: totalLogs,
                    successful: successfulLogins,
                    failed: failedLogins
                },
                today: {
                    all: todayLogins,
                    successful: todaySuccessful,
                    failed: todayFailed
                },
                last7Days,
                recentActivity: recentLogs
            }
        });
    } catch (error) {
        console.error('Error fetching login logs summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch login logs summary',
            error: error.message
        });
    }
};

// Get login logs for a specific user
const getUserLoginLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        // Calculate pagination values
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Execute queries
        const [logs, total] = await Promise.all([
            LoginLog.find({ userId })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            LoginLog.countDocuments({ userId })
        ]);

        // Calculate pagination metadata
        const totalPages = Math.ceil(total / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        return res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages,
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (error) {
        console.error(`Error fetching login logs for user ${req.params.userId}:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user login logs',
            error: error.message
        });
    }
};

module.exports = {
    getLoginLogs,
    getLoginLogsSummary,
    getUserLoginLogs
};