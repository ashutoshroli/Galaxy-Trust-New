import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';

const router = express.Router();
router.use(authenticate);

// List all meetings
router.get('/', asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM meetings ORDER BY meeting_date DESC, id DESC');
    res.json(result.rows);
  }));

// Get one meeting with attendance list
router.get('/:id', asyncHandler(async (req, res) => {
    const meeting = await pool.query('SELECT * FROM meetings WHERE id=$1', [req.params.id]);
    if (!meeting.rows[0]) return notFound(res);

    const attendance = await pool.query(
      `SELECT a.member_id, m.name, a.present
     FROM meeting_attendance a JOIN members m ON a.member_id = m.id
     WHERE a.meeting_id = $1 ORDER BY m.name`,
      [req.params.id]
    );

    res.json({ ...meeting.rows[0], attendance: attendance.rows });
  }));

// Create meeting + attendance list
// body: { meeting_date, location, subject, description, attendance: [{member_id, present}] }
router.post('/', canAdd, async (req, res) => {
  const { meeting_date, location, subject, description, attendance } = req.body;
  if (!meeting_date) return res.status(400).json({ error: 'meeting_date required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const meetingResult = await client.query(
      `INSERT INTO meetings (meeting_date, location, subject, description, added_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [meeting_date, location, subject, description, req.user.id]
    );
    const meeting = meetingResult.rows[0];

    if (Array.isArray(attendance)) {
      for (const a of attendance) {
        await client.query(
          `INSERT INTO meeting_attendance (meeting_id, member_id, present)
           VALUES ($1,$2,$3)
           ON CONFLICT (meeting_id, member_id) DO UPDATE SET present = EXCLUDED.present`,
          [meeting.id, a.member_id, !!a.present]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(meeting);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create meeting' });
  } finally {
    client.release();
  }
});

router.put('/:id', canEdit, async (req, res) => {
  const { meeting_date, location, subject, description } = req.body;
  const safeDate = meeting_date && meeting_date.trim() !== '' ? meeting_date : null;
  const result = await pool.query(
    `UPDATE meetings SET meeting_date=COALESCE($1, meeting_date), location=$2, subject=$3, description=$4
     WHERE id=$5 RETURNING *`,
    [safeDate, location, subject, description, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', onlySuperAdmin, async (req, res) => {
  await pool.query('DELETE FROM meetings WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

export default router;
