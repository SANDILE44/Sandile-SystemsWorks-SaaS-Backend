const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

const MAX_RECENTS = 3; // ✅ you want only 3 on dashboard

router.post('/recent-calculators', auth, async (req, res) => {
  try {
    const { key, title, url } = req.body;
    if (!key || !title || !url) {
      return res.status(400).json({ error: 'key, title, url required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.recentCalculators = (user.recentCalculators || []).filter(
      (c) => c.key !== key
    );

    user.recentCalculators.unshift({
      key,
      title,
      url,
      lastOpenedAt: new Date(),
    });

    user.recentCalculators = user.recentCalculators.slice(0, MAX_RECENTS);

    await user.save();

    res.json({ recentCalculators: user.recentCalculators });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update recents' });
  }
});

module.exports = router;
