-- =====================================================================
-- DropBoxed: reference data
-- Water issue categories from Part 2 (Proposed Features #2).
-- Staff accounts are created by scripts/db-setup.js so passwords can be
-- hashed with bcrypt.
-- =====================================================================

SET search_path TO dropboxed;

INSERT INTO complaint_categories (category_name, description) VALUES
    ('Rusty / Contaminated Water',
     'Brown, yellow or cloudy water, sediment, or water suspected to be contaminated by old or corroded pipelines. May contain lead, bacteria or sediment.'),
    ('Low Water Pressure',
     'Weak flow or intermittent water supply at the household tap.'),
    ('Foul Odor',
     'Water with an unusual smell such as sulfur, sewage, chlorine or a musty odor.'),
    ('Pipe Leak',
     'Visible leaks or bursts in household service pipes or connections.')
ON CONFLICT (category_name) DO NOTHING;
