const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const fs = require('fs');
const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
        console.error('Error creating data directory:', err);
    }
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database opening error:', err.message);
    }
});

db.serialize(() => {
    // Users table with role
    db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            app_secret TEXT UNIQUE,
            role TEXT DEFAULT 'user'
        )`, (err) => {
        if (err) console.error('Error creating users table:', err);
        else {
            // Create default admin if not exists
            const bcrypt = require('bcryptjs');
            const adminPass = bcrypt.hashSync('admin123', 10);
            const adminSecret = require('crypto').randomBytes(16).toString('hex');

            db.run(`INSERT OR IGNORE INTO users (username, password, app_secret, role) 
                        VALUES ('admin', ?, ?, 'admin')`, [adminPass, adminSecret], (err) => {
                if (err) console.error('Error creating default admin:', err);
                else console.log('Default admin created (admin/admin123)');
            });
        }
    });

    // Sessions table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
            user_id INTEGER PRIMARY KEY,
            status TEXT DEFAULT 'disconnected',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
});

const Database = {
    createUser: (username, password, appSecret) => {
        return new Promise((resolve, reject) => {
            const hash = bcrypt.hashSync(password, 10);
            db.run(`INSERT INTO users (username, password, app_secret) VALUES (?, ?, ?)`,
                [username, hash, appSecret],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    updateUser: (id, password, role) => {
        return new Promise((resolve, reject) => {
            let query = 'UPDATE users SET role = ?';
            let params = [role];

            if (password) {
                const hash = bcrypt.hashSync(password, 10);
                query += ', password = ?';
                params.push(hash);
            }

            query += ' WHERE id = ?';
            params.push(id);

            db.run(query, params, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    getUserByUsername: (username) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    updateSessionStatus: (userId, status) => {
        return new Promise((resolve, reject) => {
            db.run(`INSERT OR REPLACE INTO sessions (user_id, status) VALUES (?, ?)`,
                [userId, status],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },

    getSessionStatus: (userId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT status FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.status : 'disconnected');
            });
        });
    },

    getDb: () => db
};

module.exports = Database;
