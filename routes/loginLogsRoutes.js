const express = require('express');
const router = express.Router();
const { getLoginLogs, getLoginLogsSummary, getUserLoginLogs } = require('../controller/loginLogsController');
const authMiddleware = require('../middleware/routesAuth');

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// Get all login logs with pagination and filtering
router.get('/', getLoginLogs);

// Get login logs summary
router.get('/summary', getLoginLogsSummary);

// Get login logs for a specific user
router.get('/user/:userId', getUserLoginLogs);

module.exports = router;