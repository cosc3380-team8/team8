-- Team 8: the website's demo logins, added to the real database so the real login accepts them.
-- Same emails and passwords as the login info in the Google Doc:
--   admin123 (Azael), staff123 (Clark), student123 (Esther, Ben, Uriel), faculty123 (Aliza, Dan)
-- Passwords are stored as bcrypt hashes. Safe to run more than once: emails already in the database are skipped.

INSERT INTO dbo.[staff] (first_name, last_name, email, password, is_admin, is_active)
SELECT v.first_name, v.last_name, v.email, v.hash, v.is_admin, 1
FROM (VALUES
    (N'Azael', N'Aaron',  N'azael@library.edu', N'$2b$10$RrdF8mCNp1t2l6iztqLkzeXfHfzf3TevE/I2c50iSmnpFWGB8igAm', 1),
    (N'Clark', N'Nguyen', N'clark@library.edu', N'$2b$10$VMvuL2hsdSGNi4MGNLqLo.KXI4cofaAL/1.FWdpr5DXu9leMF/SDK', 0)
) AS v (first_name, last_name, email, hash, is_admin)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[staff] AS s WHERE s.email = v.email)
  AND NOT EXISTS (SELECT 1 FROM dbo.[user] AS u WHERE u.email = v.email);

INSERT INTO dbo.[user] (first_name, last_name, email, password, is_faculty, is_active)
SELECT v.first_name, v.last_name, v.email, v.hash, v.is_faculty, 1
FROM (VALUES
    (N'Esther', N'Burns',  N'esther@uni.edu', N'$2b$10$NdqmATncHodzR9zggjEqLOYKcPgCx2gLLxiLIHOKE21UMgSshIRI.', 0),
    (N'Ben',    N'Carter', N'ben@uni.edu',    N'$2b$10$NdqmATncHodzR9zggjEqLOYKcPgCx2gLLxiLIHOKE21UMgSshIRI.', 0),
    (N'Uriel',  N'Smith',  N'uriel@uni.edu',  N'$2b$10$NdqmATncHodzR9zggjEqLOYKcPgCx2gLLxiLIHOKE21UMgSshIRI.', 0),
    (N'Aliza',  N'Salman', N'aliza@uni.edu',  N'$2b$10$IvHe94PYqs.JcPkZOMnz8eU.7BHttbkhnMdKgCN/muyWDy/PuotBG', 1),
    (N'Dan',    N'Okafor', N'dan@uni.edu',    N'$2b$10$IvHe94PYqs.JcPkZOMnz8eU.7BHttbkhnMdKgCN/muyWDy/PuotBG', 1)
) AS v (first_name, last_name, email, hash, is_faculty)
WHERE NOT EXISTS (SELECT 1 FROM dbo.[user] AS u WHERE u.email = v.email)
  AND NOT EXISTS (SELECT 1 FROM dbo.[staff] AS s WHERE s.email = v.email);

-- Should list all 7 accounts.
SELECT N'staff' AS [table], first_name, last_name, email FROM dbo.[staff] WHERE email LIKE N'%@library.edu'
UNION ALL
SELECT N'user', first_name, last_name, email FROM dbo.[user] WHERE email LIKE N'%@uni.edu';
