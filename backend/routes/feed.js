import express from 'express';
import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { cloudinaryConfigured, uploadImage } from '../utils/cloudinary.js';

const router = express.Router();
router.use(authenticate);

// Allowed reaction emojis
const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🙏'];
const MAX_IMAGES = 10;
const MAX_CONTENT_LEN = 5000;
const MAX_IMAGE_CHARS = 3_000_000; // ~2.2MB per image (base64)

// Normalize an images payload (accepts new `images` array or legacy single `image_data`)
function normalizeImages(images, image_data) {
  let list = Array.isArray(images) ? images : [];
  list = list.filter((x) => typeof x === 'string' && x.trim() !== '');
  if (list.length === 0 && image_data && image_data.trim() !== '') list = [image_data];
  return list.slice(0, MAX_IMAGES);
}

// Validate content + images. Returns an error string or null.
function validatePost(content, imageList) {
  if (content && content.length > MAX_CONTENT_LEN) {
    return `Post text bahut lamba hai (max ${MAX_CONTENT_LEN} characters).`;
  }
  for (const img of imageList) {
    const isUrl = /^https?:\/\//.test(img);
    if (!isUrl && img.length > MAX_IMAGE_CHARS) {
      return 'Ek image bahut badi hai. Chhoti image use karo.';
    }
  }
  return null;
}

// If Cloudinary is configured, upload base64 images and return their URLs.
// Otherwise return the list unchanged (base64 stored in DB). Existing URLs are kept as-is.
async function processImages(list) {
  if (!cloudinaryConfigured()) return list;
  const out = [];
  for (const img of list) {
    if (/^https?:\/\//.test(img)) out.push(img);
    else out.push(await uploadImage(img));
  }
  return out;
}

// GET /feed - all posts (newest first) with author, tags, reactions, my reaction, comments
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const offset = parseInt(req.query.offset, 10) || 0;

    const postsResult = await pool.query(
      `SELECT p.id, p.content, p.image_data, p.location, p.created_at, p.author_user_id, p.edit_count,
              COALESCE(m.name, u.username) AS author_name, COALESCE(m.role, u.role) AS author_role
       FROM feed_posts p
       LEFT JOIN users u ON p.author_user_id = u.id
       LEFT JOIN members m ON u.member_id = m.id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $1 OFFSET $2`,
      [limit + 1, offset]
    );

    const rows = postsResult.rows;
    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit);
    const ids = posts.map((p) => p.id);

    if (ids.length === 0) return res.json({ posts: [], hasMore: false });

    const [tagsRes, reactionsRes, myReactionsRes, commentsRes, imagesRes] = await Promise.all([
      pool.query(
        `SELECT t.post_id, t.tagged_type, t.tagged_id,
                CASE WHEN t.tagged_type='member' THEN m.name ELSE s.name END AS name
         FROM feed_post_tags t
         LEFT JOIN members m ON t.tagged_type='member' AND m.id = t.tagged_id
         LEFT JOIN staff s ON t.tagged_type='staff' AND s.id = t.tagged_id
         WHERE t.post_id = ANY($1::int[])`,
        [ids]
      ),
      pool.query(
        `SELECT post_id, reaction, COUNT(*)::int AS count
         FROM feed_reactions WHERE post_id = ANY($1::int[])
         GROUP BY post_id, reaction`,
        [ids]
      ),
      pool.query(
        `SELECT post_id, reaction FROM feed_reactions
         WHERE post_id = ANY($1::int[]) AND user_id = $2`,
        [ids, req.user.id]
      ),
      pool.query(
        `SELECT c.id, c.post_id, c.content, c.created_at, c.user_id,
                COALESCE(m.name, u.username) AS author_name, COALESCE(m.role, u.role) AS author_role
         FROM feed_comments c
         LEFT JOIN users u ON c.user_id = u.id
         LEFT JOIN members m ON u.member_id = m.id
         WHERE c.post_id = ANY($1::int[])
         ORDER BY c.created_at ASC, c.id ASC`,
        [ids]
      ),
      pool.query(
        `SELECT post_id, image_data FROM feed_post_images
         WHERE post_id = ANY($1::int[])
         ORDER BY post_id, position ASC, id ASC`,
        [ids]
      ),
    ]);

    const byPost = {};
    posts.forEach((p) => {
      byPost[p.id] = { ...p, tags: [], reactions: {}, my_reaction: null, comments: [], images: [] };
    });
    tagsRes.rows.forEach((t) => byPost[t.post_id]?.tags.push({ type: t.tagged_type, id: t.tagged_id, name: t.name }));
    reactionsRes.rows.forEach((r) => { byPost[r.post_id].reactions[r.reaction] = r.count; });
    myReactionsRes.rows.forEach((r) => { byPost[r.post_id].my_reaction = r.reaction; });
    commentsRes.rows.forEach((c) => byPost[c.post_id]?.comments.push(c));
    imagesRes.rows.forEach((im) => byPost[im.post_id]?.images.push(im.image_data));

    // Legacy fallback: older posts stored a single image in feed_posts.image_data
    posts.forEach((p) => {
      if (byPost[p.id].images.length === 0 && p.image_data) byPost[p.id].images = [p.image_data];
    });

    res.json({ posts: posts.map((p) => byPost[p.id]), hasMore });
  })
);

// POST /feed - create a post (any authenticated user)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { content, image_data, images, location, tags } = req.body;
    const hasContent = content && content.trim() !== '';
    const imageList = normalizeImages(images, image_data);
    if (!hasContent && imageList.length === 0) return badRequest(res, 'Post me text ya photo me se kuch to daalo');

    const vErr = validatePost(content, imageList);
    if (vErr) return badRequest(res, vErr);

    const cleanTags = Array.isArray(tags)
      ? tags
          .filter((t) => (t.type === 'member' || t.type === 'staff') && t.id)
          .map((t) => ({ type: t.type, id: parseInt(t.id) }))
      : [];

    let storedImages;
    try {
      storedImages = await processImages(imageList);
    } catch (e) {
      return res.status(502).json({ error: `Image upload failed: ${e.message}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO feed_posts (author_user_id, content, image_data, location)
         VALUES ($1, $2, NULL, $3) RETURNING *`,
        [req.user.id, hasContent ? content : null, location || null]
      );
      const post = result.rows[0];
      for (const t of cleanTags) {
        await client.query(
          `INSERT INTO feed_post_tags (post_id, tagged_type, tagged_id) VALUES ($1, $2, $3)`,
          [post.id, t.type, t.id]
        );
      }
      for (let i = 0; i < storedImages.length; i++) {
        await client.query(
          `INSERT INTO feed_post_images (post_id, image_data, position) VALUES ($1, $2, $3)`,
          [post.id, storedImages[i], i]
        );
      }
      await client.query('COMMIT');
      res.status(201).json(post);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// PUT /feed/:id - edit a post. Author can edit own up to 5 times (no delete).
// Superadmin can edit any post without limit (and superadmin edits don't burn the limit).
const MAX_MEMBER_EDITS = 5;
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { content, image_data, images, location, tags } = req.body;

    const postRes = await pool.query('SELECT author_user_id, edit_count FROM feed_posts WHERE id=$1', [req.params.id]);
    if (!postRes.rows[0]) return notFound(res, 'Post not found');
    const post = postRes.rows[0];

    const isSuper = req.user.role === 'superadmin';
    const isAuthor = post.author_user_id === req.user.id;
    if (!isAuthor && !isSuper) return res.status(403).json({ error: 'Sirf apni post edit kar sakte ho' });
    if (isAuthor && !isSuper && post.edit_count >= MAX_MEMBER_EDITS) {
      return res.status(403).json({ error: `Post ${MAX_MEMBER_EDITS} baar edit ho chuki hai, ab aur edit nahi kar sakte.` });
    }

    const hasContent = content && content.trim() !== '';
    const imageList = normalizeImages(images, image_data);
    if (!hasContent && imageList.length === 0) return badRequest(res, 'Post me text ya photo me se kuch to daalo');

    const vErr = validatePost(content, imageList);
    if (vErr) return badRequest(res, vErr);

    const cleanTags = Array.isArray(tags)
      ? tags
          .filter((t) => (t.type === 'member' || t.type === 'staff') && t.id)
          .map((t) => ({ type: t.type, id: parseInt(t.id) }))
      : [];

    // Member edits increment the counter; superadmin edits do not.
    const increment = isAuthor && !isSuper ? 1 : 0;

    let storedImages;
    try {
      storedImages = await processImages(imageList);
    } catch (e) {
      return res.status(502).json({ error: `Image upload failed: ${e.message}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE feed_posts
         SET content=$1, image_data=NULL, location=$2, edit_count = edit_count + $3
         WHERE id=$4 RETURNING *`,
        [hasContent ? content : null, location || null, increment, req.params.id]
      );
      await client.query('DELETE FROM feed_post_tags WHERE post_id=$1', [req.params.id]);
      for (const t of cleanTags) {
        await client.query(
          `INSERT INTO feed_post_tags (post_id, tagged_type, tagged_id) VALUES ($1, $2, $3)`,
          [req.params.id, t.type, t.id]
        );
      }
      await client.query('DELETE FROM feed_post_images WHERE post_id=$1', [req.params.id]);
      for (let i = 0; i < storedImages.length; i++) {
        await client.query(
          `INSERT INTO feed_post_images (post_id, image_data, position) VALUES ($1, $2, $3)`,
          [req.params.id, storedImages[i], i]
        );
      }
      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// DELETE /feed/:id - ONLY superadmin (members cannot delete their posts)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Post delete sirf superadmin kar sakta hai.' });
    }
    const result = await pool.query('SELECT 1 FROM feed_posts WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return notFound(res, 'Post not found');
    await pool.query('DELETE FROM feed_posts WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  })
);

// POST /feed/:id/react - toggle/set reaction
router.post(
  '/:id/react',
  asyncHandler(async (req, res) => {
    const { reaction } = req.body;
    if (!REACTIONS.includes(reaction)) return badRequest(res, 'Invalid reaction');

    const postExists = await pool.query('SELECT 1 FROM feed_posts WHERE id=$1', [req.params.id]);
    if (!postExists.rows[0]) return notFound(res, 'Post not found');

    const existing = await pool.query(
      'SELECT reaction FROM feed_reactions WHERE post_id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );

    if (existing.rows[0] && existing.rows[0].reaction === reaction) {
      // same reaction clicked again -> remove (toggle off)
      await pool.query('DELETE FROM feed_reactions WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      return res.json({ reaction: null });
    }

    await pool.query(
      `INSERT INTO feed_reactions (post_id, user_id, reaction) VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()`,
      [req.params.id, req.user.id, reaction]
    );
    res.json({ reaction });
  })
);

// POST /feed/:id/comments - add a comment
router.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content || content.trim() === '') return badRequest(res, 'Comment khaali nahi ho sakta');

    const postExists = await pool.query('SELECT 1 FROM feed_posts WHERE id=$1', [req.params.id]);
    if (!postExists.rows[0]) return notFound(res, 'Post not found');

    const result = await pool.query(
      `INSERT INTO feed_comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  })
);

// DELETE /feed/comments/:commentId - author or superadmin
router.delete(
  '/comments/:commentId',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT user_id FROM feed_comments WHERE id=$1', [req.params.commentId]);
    if (!result.rows[0]) return notFound(res, 'Comment not found');
    if (result.rows[0].user_id !== req.user.id && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Sirf apna comment ya superadmin delete kar sakta hai' });
    }
    await pool.query('DELETE FROM feed_comments WHERE id=$1', [req.params.commentId]);
    res.json({ message: 'Deleted' });
  })
);

export default router;
