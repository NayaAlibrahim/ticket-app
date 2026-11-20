const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  venue: z.string().min(1).max(200),
  starts_at: z.string().datetime(),
  price_cents: z.number().int().min(0).max(1000000),
  capacity: z.number().int().min(1).max(100000),
});

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM events ORDER BY starts_at');
  res.json(result.rows);
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid event data' });
  const e = parsed.data;
  const result = await pool.query(
    `INSERT INTO events (title, description, venue, starts_at, price_cents, capacity)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [e.title, e.description || null, e.venue, e.starts_at, e.price_cents, e.capacity]
  );
  logger.info('event_created', { adminId: req.user.id, eventId: result.rows[0].id });
  res.status(201).json(result.rows[0]);
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  logger.info('event_deleted', { adminId: req.user.id, eventId: result.rows[0].id });
  res.status(204).end();
});

module.exports = router;