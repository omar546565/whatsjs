const express = require('express');
const router = express.Router();
const Database = require('../database');
const WhatsAppManager = require('../whatsapp-manager');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware to verify JWT
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

// Get WhatsApp Status
router.get('/status', authenticateToken, async (req, res) => {
    const status = await Database.getSessionStatus(req.user.id);
    res.json({ status });
});

// Initialize WhatsApp (Get QR)
router.get('/init', authenticateToken, async (req, res) => {
    const io = req.app.get('socketio');
    await WhatsAppManager.initClient(req.user.id, io);
    res.json({ success: true, message: 'Initialization started' });
});

// Disconnect WhatsApp
router.post('/disconnect', authenticateToken, async (req, res) => {
    try {
        await WhatsAppManager.disconnectClient(req.user.id);
        res.json({ success: true, message: 'Disconnected successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Messaging API (The one requested by user)
// POST /api/sent/:id
router.post('/sent/:id', async (req, res) => {
    const { user_id, app_secret, message } = req.body;
    const userIdFromParam = req.params.id;
    const number = (req.body.number || '').replace(/^(00|\+)/, '');

    // Validate user and secret
    const user = await Database.getUserById(user_id);
    if (!user || user.app_secret !== app_secret || String(user.id) !== String(userIdFromParam)) {
        return res.status(401).json({ success: false, error: 'Invalid user_id or app_secret' });
    }

    try {
        await WhatsAppManager.sendMessage(user_id, number, message);
        res.json({ success: true, message: 'Message sent' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
