import express from 'express';
import { pool } from '../db.js';
import { authenticate, canAdd, canEdit, onlySuperAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { cloudinaryConfigured, uploadImage } from '../utils/cloudinary.js';

const router = express.Router();
router.use(authenticate);

// If a photo is a base64 data URI and Cloudinary is configured, upload it and
// return the hosted URL (keeps the DB light). Otherwise return it unchanged.
async function processPhoto(photo) {
  if (!photo || typeof photo !== 'string') return photo;
  if (/^https?:\/\//.test(photo)) return photo; // already a hosted URL
  if (!cloudinaryConfigured()) return photo; // no Cloudinary -> keep base64 in DB
  try {
    return await uploadImage(photo, 'galaxy_trust_members');
  } catch (e) {
    return photo; // fall back to base64 on upload failure
  }
}

// View - everyone (all roles including trustee)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM members ORDER BY id');
    res.json(result.rows);
  })
);

// GET /me - the logged-in user's own linked member profile
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user.member_id) return res.json(null);
    const result = await pool.query('SELECT * FROM members WHERE id=$1', [req.user.member_id]);
    res.json(result.rows[0] || null);
  })
);

// PUT /me - a member edits their OWN personal details (role/active cannot be changed here)
router.put(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user.member_id) return badRequest(res, 'No member profile is linked to this account.');
    const { name, relation_name, address, phone, email, dob, photo } = req.body;
    if (!name || name.trim() === '') return badRequest(res, 'name required');
    const safeDob = dob && dob.trim() !== '' ? dob : null;
    const photoVal = await processPhoto(photo);
    const result = await pool.query(
      `UPDATE members SET name=$1, relation_name=$2, address=$3, phone=$4, email=$5, dob=$6, photo=COALESCE($7, photo)
       WHERE id=$8 RETURNING *`,
      [name, relation_name, address, phone, email, safeDob, photoVal ?? null, req.user.member_id]
    );
    if (!result.rows[0]) return notFound(res);
    await pool.query('UPDATE users SET phone=$1 WHERE member_id=$2', [phone || null, req.user.member_id]);
    res.json(result.rows[0]);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM members WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

// Add - president/secretary/treasurer/superadmin
router.post(
  '/',
  canAdd,
  asyncHandler(async (req, res) => {
    const { name, relation_name, role, address, aadhar_last4, phone, dob, photo, email } = req.body;
    if (!name || !role) return badRequest(res, 'name and role required');
    const safeDob = dob && dob.trim() !== '' ? dob : null;
    const photoVal = await processPhoto(photo);
    const result = await pool.query(
      `INSERT INTO members (name, relation_name, role, address, aadhar_last4, phone, dob, photo, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, relation_name, role, address, aadhar_last4, phone, safeDob, photoVal || null, email || null]
    );
    res.status(201).json(result.rows[0]);
  })
);

// Edit - superadmin only
router.put(
  '/:id',
  canEdit,
  asyncHandler(async (req, res) => {
    const { name, relation_name, role, address, aadhar_last4, phone, dob, photo, active, email } = req.body;
    const safeDob = dob && dob.trim() !== '' ? dob : null;
    const photoVal = await processPhoto(photo);
    const result = await pool.query(
      `UPDATE members SET name=$1, relation_name=$2, role=$3, address=$4, aadhar_last4=$5, phone=$6,
              dob=$7, photo=COALESCE($8, photo), active=COALESCE($9, active), email=$10
       WHERE id=$11 RETURNING *`,
      [name, relation_name, role, address, aadhar_last4, phone, safeDob, photoVal ?? null, active, email, req.params.id]
    );
    if (!result.rows[0]) return notFound(res);
    // Keep the linked login account's phone in sync (used for mobile login)
    await pool.query('UPDATE users SET phone=$1 WHERE member_id=$2', [phone || null, req.params.id]);
    res.json(result.rows[0]);
  })
);

// Toggle active/inactive status - superadmin only
router.patch(
  '/:id/status',
  canEdit,
  asyncHandler(async (req, res) => {
    const { active } = req.body;
    const result = await pool.query(
      'UPDATE members SET active=$1 WHERE id=$2 RETURNING *',
      [!!active, req.params.id]
    );
    if (!result.rows[0]) return notFound(res);
    res.json(result.rows[0]);
  })
);

// Delete - superadmin only
router.delete(
  '/:id',
  onlySuperAdmin,
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM members WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  })
);

export default router;
