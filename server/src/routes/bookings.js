const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const bookSchema = z.object({
  event_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10),
});

router.post('/', async (req, res) => {
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid booking data' });
  const { event_id, quantity } = parsed.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await client.query('SELECT capacity FROM events WHERE id = $1 FOR UPDATE', [event_id]);
    if (!ev.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const sold = await client.query(
      'SELECT COALESCE(SUM(quantity), 0)::int AS n FROM bookings WHERE event_id = $1',
      [event_id]
    );
    if (sold.rows[0].n + quantity > ev.rows[0].capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Not enough tickets left' });
    }
    const ins = await client.query(
      'INSERT INTO bookings (user_id, event_id, quantity) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, event_id, quantity]
    );
    await client.query('COMMIT');
    logger.info('booking_created', { userId: req.user.id, bookingId: ins.rows[0].id });
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('booking_error', { message: err.message });
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT b.id, b.quantity, b.created_at, e.title, e.venue, e.starts_at
     FROM bookings b JOIN events e ON e.id = b.event_id
     WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

router.delete('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const result = await pool.query(
    'DELETE FROM bookings WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  logger.info('booking_cancelled', { userId: req.user.id, bookingId: result.rows[0].id });
  res.status(204).end();
});

module.exports = router;