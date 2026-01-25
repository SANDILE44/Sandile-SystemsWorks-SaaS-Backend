const express = require('express');
const router = express.Router();

// Test user route
router.get('/', (req, res) => {
  res.json({ message: 'Calculators route works!' });
});

module.exports = router;
