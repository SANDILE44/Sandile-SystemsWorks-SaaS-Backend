import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // ✅ Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ NORMALIZE ID (this is the real fix)
    const userId = decoded.id || decoded._id || decoded.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // ✅ Load user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // ✅ What calculators expect
    req.user = { id: user._id.toString() };

    // (optional but useful later)
    req.userDoc = user;

    next();
  } catch (err) {
    console.error('AUTH ERROR:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
