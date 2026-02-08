import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Calculators API working' });
});

export default router;
