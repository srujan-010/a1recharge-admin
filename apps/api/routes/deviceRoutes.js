const express = require('express');
const router = express.Router();
const { registerDevice } = require('../controllers/deviceController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', protect, registerDevice);

module.exports = router;
