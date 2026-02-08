import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = { id: user._id.toString() };
    req.userDoc = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
