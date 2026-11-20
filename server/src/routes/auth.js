const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const logger = require('../utils/logger');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(10).max(128),
});
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email, or password shorter than 10 characters' });
  }
  const email = parsed.data.email.toLowerCase();
  try {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
      [email, hash]
    );
    logger.info('register_success', { userId: result.rows[0].id, ip: req.ip });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      logger.warn('register_duplicate', { ip: req.ip });
      return res.status(409).json({ error: 'Email already registered' });
    }
    logger.error('register_error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const email = parsed.data.email.toLowerCase();
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    const ok = user && (await bcrypt.compare(parsed.data.password, user.password_hash));
    if (!ok) {
      logger.warn('login_failed', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    logger.info('login_success', { userId: user.id, ip: req.ip });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    logger.error('login_error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;