CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, published_at TEXT, updated_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS administrators (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS setup_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);

-- Multi-user accounts; keep the legacy table intact for rollback.
CREATE TABLE IF NOT EXISTS administrator_accounts (email TEXT PRIMARY KEY, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL);
INSERT OR IGNORE INTO administrator_accounts(email,password_hash,salt,created_at) SELECT lower(email),password_hash,salt,created_at FROM administrators;
