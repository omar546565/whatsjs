const express = require('express');
const router = express.Router();
const Database = require('../database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    const db = Database.getDb();
    db.get('SELECT role FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row || row.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Access denied. Admins only.' });
        }
        next();
    });
};

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const db = Database.getDb();

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!user) return res.status(400).json({ success: false, error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ success: false, error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, app_secret: user.app_secret, role: user.role } });
    });
});

// Create User (Admin only)
// Note: authenticateToken must be imported or available. 
// Assuming it's in a middleware file or we need to import it here if it's not global.
// Checking previous files, authenticateToken was likely in api.js, let's duplicate or move it.
// For now, I'll rely on the fact that I need to add it to this file or import it.
// Let's add a simple verify function here since it's not exported from api.js
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

router.post('/create_user', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    const db = Database.getDb();
    const app_secret = crypto.randomBytes(16).toString('hex');

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password, app_secret) VALUES (?, ?, ?)',
            [username, hashedPassword, app_secret],
            function (err) {
                if (err) return res.status(400).json({ success: false, error: 'Username already exists' });
                res.json({ success: true, message: 'User created successfully', userId: this.lastID });
            }
        );
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, isAdmin, (req, res) => {
    const db = Database.getDb();
    db.all('SELECT id, username, role, app_secret FROM users', (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, users: rows });
    });
});

// Update User (Admin only)
router.put('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { password, role } = req.body;
    const userId = req.params.id;

    try {
        await Database.updateUser(userId, password, role);
        res.json({ success: true, message: 'User updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
