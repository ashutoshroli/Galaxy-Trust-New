-- Galaxy Educational and Social Welfare Trust - Database Schema
-- PostgreSQL

CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    relation_name VARCHAR(150),       -- father/husband name
    role VARCHAR(20) NOT NULL CHECK (role IN ('president','secretary','treasurer','trustee')),
    address TEXT,
    aadhar_last4 VARCHAR(4),
    phone VARCHAR(15),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','admin','manager','president','secretary','treasurer','trustee','viewer')),
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    phone VARCHAR(15),
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contributions (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode VARCHAR(20) DEFAULT 'cash',  -- cash / online / cheque
    remarks TEXT,
    installment_id INTEGER,
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100),            -- education / health / event / admin etc
    description TEXT,
    used_for TEXT,                    -- kis kaam me use hua
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS installments (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL DEFAULT 'General',  -- free text, e.g. Membership Fee / Building Fund
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date DATE,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    meeting_date DATE NOT NULL,
    location VARCHAR(200),
    subject VARCHAR(200),
    description TEXT,
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attendance (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    present BOOLEAN DEFAULT FALSE,
    UNIQUE(meeting_id, member_id)
);

CREATE TABLE IF NOT EXISTS login_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username VARCHAR(50),
    action VARCHAR(50),               -- login_success / login_failed / logout / locked
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Staff (teachers/helpers/etc.) and their payment history
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    contact VARCHAR(15),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_payments (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    remarks TEXT,
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Social feed: posts, tags, reactions, comments
CREATE TABLE IF NOT EXISTS feed_posts (
    id SERIAL PRIMARY KEY,
    author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    image_data TEXT,                  -- base64 data URL (optional)
    location VARCHAR(200),
    edit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
-- Safety net for databases created before edit_count existed
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS feed_post_tags (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    tagged_type VARCHAR(10) NOT NULL CHECK (tagged_type IN ('member','staff')),
    tagged_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_reactions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(16) NOT NULL,    -- emoji
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (post_id, user_id)         -- one (changeable) reaction per user per post
);

CREATE TABLE IF NOT EXISTS feed_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Multiple images per post (up to 10, enforced in the app)
CREATE TABLE IF NOT EXISTS feed_post_images (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cashiers: members designated to handle money moving IN/OUT
CREATE TABLE IF NOT EXISTS cashiers (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Per-transaction cashier allocations (polymorphic).
-- ref_type + ref_id point to a contribution / expense / staff_payment row.
-- direction: 'in' = collected (contributions), 'out' = disbursed (expenses / staff payments)
CREATE TABLE IF NOT EXISTS cashier_allocations (
    id SERIAL PRIMARY KEY,
    ref_type VARCHAR(20) NOT NULL CHECK (ref_type IN ('contribution','expense','staff_payment')),
    ref_id INTEGER NOT NULL,
    cashier_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    direction VARCHAR(3) NOT NULL CHECK (direction IN ('in','out')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Allow the expanded set of login roles on existing databases too
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin','admin','manager','president','secretary','treasurer','trustee','viewer'));

-- Login by mobile: store phone on the user account and keep it in sync with the member
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
UPDATE users u SET phone = m.phone
  FROM members m
  WHERE u.member_id = m.id AND (u.phone IS NULL OR u.phone = '');

-- Helpful indexes for the most common lookups / joins
CREATE INDEX IF NOT EXISTS idx_contributions_member ON contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_installment ON contributions(installment_id);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(contribution_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_installments_member ON installments(member_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_staff ON staff_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_user ON login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON feed_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_feed_tags_post ON feed_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON feed_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_images_post ON feed_post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_cashier_alloc_ref ON cashier_allocations(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_cashier_alloc_cashier ON cashier_allocations(cashier_member_id);
CREATE INDEX IF NOT EXISTS idx_cashier_alloc_direction ON cashier_allocations(direction);

-- Add FK constraint now that both tables exist
ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS fk_contributions_installment;
ALTER TABLE contributions
  ADD CONSTRAINT fk_contributions_installment
  FOREIGN KEY (installment_id) REFERENCES installments(id) ON DELETE SET NULL;

-- Seed: trust members (21 total) - only when the table is empty (idempotent, no duplicates on re-run)
INSERT INTO members (name, relation_name, role, address)
SELECT v.name, v.relation_name, v.role, v.address FROM (VALUES
('Kiran Devi', 'Umakant Sharan', 'president', 'Gaulghaiya, Siyatand, Jamua, Giridih'),
('Babita Verma', 'Sitaram Verma', 'secretary', 'Jangridih, Siyatand, Jamua, Giridih'),
('Rekha Verma', 'Devendra Prasad Verma', 'treasurer', 'Shaharpura, Siyatand, Jamua, Giridih'),
('Nand Kishor Kumar Verma', 'Jhupu Mahto', 'trustee', 'Jangridih, Siyatand, Jamua, Giridih'),
('Renu Kumari', 'Vikas Kumar Verma', 'trustee', 'Shaharpura, Siyatand, Jamua, Giridih'),
('Sangita Verma', 'Ajay Kumar Verma', 'trustee', 'Shaharpura, Siyatand, Jamua, Giridih'),
('Geeta Devi', 'Dashrath Prasad Verma', 'trustee', 'Jangridih, Siyatand, Jamua, Giridih'),
('Krishna Ranjan Verma', 'Murli Prasad Mahto', 'trustee', 'Jangridih, Siyatand, Jamua, Giridih'),
('Priyanka Kumari', 'Pawan Kumar Verma', 'trustee', 'Dharampur, Jamaltand, Chittardih, Jamua, Giridih'),
('Raj Kishor Mahto', 'Late Ayodhya Mahto', 'trustee', 'Banbishunpura, Siyatand, Jamua, Giridih'),
('Parvati Kumari', 'Ranjeet Kumar Verma', 'trustee', 'Harodih, Siyatand, Jamua, Giridih'),
('Lalita Devi', 'Surendra Kumar Verma', 'trustee', 'Pardih, Khurchutta, Bengabad, Giridih'),
('Tupunarayan Prasad Verma', 'Khedan Mahto', 'trustee', 'Jangridih, Siyatand, Jamua, Giridih'),
('Bhikhan Prasad Mahto', 'Late Mangar Mahto', 'trustee', 'Shaharpura, Siyatand, Bengabad, Giridih'),
('Saraswati Devi', 'Ashok Prasad Verma', 'trustee', 'Jangridih, Siyatand, Jamua, Giridih'),
('Rukmani Devi', 'Binod Prasad Verma', 'trustee', 'Jangridih, Siyatand, Jamua, Giridih'),
('Dwarika Mahto', 'Late Guruchan Mahto', 'trustee', 'Gardih, Siyatand, Jamua, Giridih'),
('Sunil Kumar Rana', 'Bundlal Rana', 'trustee', 'Gardih, Siyatand, Jamua, Giridih'),
('Sudha Verma', 'Anil Prasad Verma', 'trustee', 'Shaharpura, Siyatand, Jamua, Giridih'),
('Yashoda Bharti', 'Mohan Prasad Verma', 'trustee', 'Baghedih, Siyatand, Jamua, Giridih'),
('Anjali Verma', 'Dhaneshwar Prasad Verma', 'trustee', 'Shaharpura, Siyatand, Jamua, Giridih')
) AS v(name, relation_name, role, address)
WHERE NOT EXISTS (SELECT 1 FROM members);
