import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { notifyAll } from '../utils/notify.js';

const router = express.Router();
router.use(authenticate);

// List all meetings
router.get('/', asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM meetings ORDER BY meeting_date DESC, id DESC');
    res.json(result.rows);
  }));

// Get one meeting with attendance list + agenda items (each with vote tally
// and, if the caller is linked to a member, their own vote on each item).
router.get('/:id', asyncHandler(async (req, res) => {
    const meeting = await pool.query('SELECT * FROM meetings WHERE id=$1', [req.params.id]);
    if (!meeting.rows[0]) return notFound(res);

    const attendance = await pool.query(
      `SELECT a.member_id, m.name, a.present
     FROM meeting_attendance a JOIN members m ON a.member_id = m.id
     WHERE a.meeting_id = $1 ORDER BY m.name`,
      [req.params.id]
    );

    const agenda = await pool.query(
      `SELECT ai.*,
              COUNT(*) FILTER (WHERE v.vote = 'yes') AS yes_count,
              COUNT(*) FILTER (WHERE v.vote = 'no') AS no_count,
              COUNT(*) FILTER (WHERE v.vote = 'abstain') AS abstain_count,
              MAX(v.vote) FILTER (WHERE v.member_id = $2) AS my_vote
       FROM meeting_agenda_items ai
       LEFT JOIN meeting_agenda_votes v ON v.agenda_item_id = ai.id
       WHERE ai.meeting_id = $1
       GROUP BY ai.id
       ORDER BY ai.position, ai.id`,
      [req.params.id, req.user.member_id || null]
    );

    res.json({ ...meeting.rows[0], attendance: attendance.rows, agenda: agenda.rows });
  }));

// Full voter breakdown for one agenda item (who voted what) — shown to
// admins/trustees reviewing a resolution.
router.get('/agenda/:itemId/votes', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT v.member_id, m.name, v.vote, v.created_at
     FROM meeting_agenda_votes v JOIN members m ON m.id = v.member_id
     WHERE v.agenda_item_id = $1
     ORDER BY m.name`,
    [req.params.itemId]
  );
  res.json(result.rows);
}));

// Create meeting + attendance list + optional agenda items
// body: { meeting_date, location, subject, description, attendance: [{member_id, present}],
//         agenda: [{ title, description }] }
router.post('/', canAdd, async (req, res) => {
  const { meeting_date, location, subject, description, minutes, attendance, agenda } = req.body;
  if (!meeting_date) return res.status(400).json({ error: 'meeting_date required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const meetingResult = await client.query(
      `INSERT INTO meetings (meeting_date, location, subject, description, minutes, added_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [meeting_date, location, subject, description, minutes || null, req.user.id]
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

    if (Array.isArray(agenda)) {
      let pos = 0;
      for (const item of agenda) {
        const title = (item?.title || '').trim();
        if (!title) continue;
        await client.query(
          `INSERT INTO meeting_agenda_items (meeting_id, position, title, description)
           VALUES ($1,$2,$3,$4)`,
          [meeting.id, pos++, title, item.description || null]
        );
      }
    }

    await client.query('COMMIT');
    notifyAll(req.user.id, {
      type: 'meeting',
      title: '📡 New Meeting',
      body: `${subject || 'Meeting'} · ${meeting_date}`,
      link: '/meetings',
    }).catch(() => {});
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
  const { meeting_date, location, subject, description, minutes } = req.body;
  const safeDate = meeting_date && meeting_date.trim() !== '' ? meeting_date : null;
  const result = await pool.query(
    `UPDATE meetings SET meeting_date=COALESCE($1, meeting_date), location=$2, subject=$3, description=$4, minutes=$5
     WHERE id=$6 RETURNING *`,
    [safeDate, location, subject, description, minutes ?? null, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', onlySuperAdmin, async (req, res) => {
  await pool.query('DELETE FROM meetings WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// --- Agenda items --------------------------------------------------------

// Add a new agenda item to an existing meeting (e.g. a resolution raised
// after the meeting notice already went out).
router.post('/:id/agenda', canAdd, asyncHandler(async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return badRequest(res, 'title required');
  const pos = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM meeting_agenda_items WHERE meeting_id = $1', [req.params.id]);
  const result = await pool.query(
    `INSERT INTO meeting_agenda_items (meeting_id, position, title, description)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, pos.rows[0].next, title, req.body.description || null]
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/agenda/:itemId', canEdit, asyncHandler(async (req, res) => {
  const { title, description, status } = req.body;
  const validStatus = ['open', 'passed', 'rejected', 'withdrawn'];
  const safeStatus = validStatus.includes(status) ? status : undefined;
  const result = await pool.query(
    `UPDATE meeting_agenda_items
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status)
     WHERE id = $4 RETURNING *`,
    [title?.trim() || null, description ?? null, safeStatus || null, req.params.itemId]
  );
  if (!result.rows[0]) return notFound(res);
  res.json(result.rows[0]);
}));

router.delete('/agenda/:itemId', onlySuperAdmin, asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM meeting_agenda_items WHERE id = $1', [req.params.itemId]);
  res.json({ message: 'Deleted' });
}));

// --- Voting ---------------------------------------------------------------

// Cast/update your vote on an agenda item. Any logged-in user linked to a
// member record can vote for themselves; a superadmin can vote on behalf of
// any member (e.g. recording a proxy or in-person show of hands).
router.post('/agenda/:itemId/vote', asyncHandler(async (req, res) => {
  const validVotes = ['yes', 'no', 'abstain'];
  const vote = req.body.vote;
  if (!validVotes.includes(vote)) return badRequest(res, "vote must be 'yes', 'no', or 'abstain'");

  let memberId = req.user.member_id;
  if (req.user.role === 'superadmin' && req.body.member_id) {
    memberId = req.body.member_id;
  }
  if (!memberId) {
    return res.status(403).json({ error: 'Your account is not linked to a member, so you cannot vote.' });
  }

  const item = await pool.query('SELECT id, status FROM meeting_agenda_items WHERE id = $1', [req.params.itemId]);
  if (!item.rows[0]) return notFound(res);
  if (item.rows[0].status !== 'open') {
    return res.status(400).json({ error: 'Voting is closed for this agenda item.' });
  }

  const result = await pool.query(
    `INSERT INTO meeting_agenda_votes (agenda_item_id, member_id, vote)
     VALUES ($1, $2, $3)
     ON CONFLICT (agenda_item_id, member_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()
     RETURNING *`,
    [req.params.itemId, memberId, vote]
  );
  res.json(result.rows[0]);
}));

export default router;
