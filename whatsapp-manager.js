const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const Database = require('./database');
const path = require('path');

const clients = {};

const initClient = async (userId, io) => {
    if (clients[userId]) {
        return clients[userId];
    }

    const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-user-${userId}`);
    // Aggressive Lock Cleanup
    if (require('fs').existsSync(sessionPath)) {
        try {
            const files = require('fs').readdirSync(sessionPath);
            const hasLock = files.includes('SingletonLock');
            const defaultPath = path.join(sessionPath, 'Default');
            const hasDefaultLock = require('fs').existsSync(defaultPath) &&
                require('fs').readdirSync(defaultPath).includes('SingletonLock');

            if (hasLock || hasDefaultLock) {
                console.log(`[Lock Detected] Found SingletonLock in ${sessionPath}. Nuking session directory...`);
                require('fs').rmSync(sessionPath, { recursive: true, force: true });
                console.log(`[Cleanup Success] Removed session directory: ${sessionPath}`);
            }
        } catch (err) {
            console.error(`[Cleanup Error] Failed to check/remove session: ${err.message}`);
        }
    }

    console.log(`Initializing client for user ${userId}...`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `user-${userId}`,
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),

        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            executablePath: process.env.CHROME_PATH || null
        }
    });

    client.on('qr', async (qr) => {
        console.log(`QR received for user ${userId}`);
        const qrDataURL = await qrcode.toDataURL(qr);
        if (io) io.emit(`qr-${userId}`, qrDataURL);
        await Database.updateSessionStatus(userId, 'qr_ready');
    });

    client.on('ready', async () => {
        console.log(`Client ready for user ${userId}`);

        // Patch sendSeen to use markSeen instead (fixes markedUnread error)
        try {
            await client.pupPage?.evaluate(() => {
                window.WWebJS.sendSeen = async (chatId) => {
                    const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
                    if (chat) {
                        window.Store.WAWebStreamModel.Stream.markAvailable();
                        await window.Store.SendSeen.markSeen(chat);
                        window.Store.WAWebStreamModel.Stream.markUnavailable();
                        return true;
                    }
                    return false;
                };
            });
            console.log(`[Runtime Patch] Applied sendSeen fix for user ${userId}`);
        } catch (patchErr) {
            console.error(`[Runtime Patch Error] Failed to apply sendSeen fix for user ${userId}:`, patchErr);
        }

        client.isReady = true;
        if (io) io.emit(`ready-${userId}`, 'Connected');
        await Database.updateSessionStatus(userId, 'connected');
    });

    client.on('authenticated', () => {
        console.log(`Authenticated for user ${userId}`);
    });

    client.on('auth_failure', async (msg) => {
        console.error(`Auth failure for user ${userId}:`, msg);
        await Database.updateSessionStatus(userId, 'disconnected');
    });

    client.on('disconnected', async (reason) => {
        console.log(`Disconnected for user ${userId}:`, reason);
        await Database.updateSessionStatus(userId, 'disconnected');
        client.isReady = false;
        delete clients[userId];
    });

    clients[userId] = client;

    try {
        await client.initialize();
    } catch (err) {
        console.error(`Init error for user ${userId}:`, err);
        // If init fails, try to clean up and retry once
        if (err.message.includes('Profile in use')) {
            console.log(`Retrying initialization for user ${userId} after cleanup...`);
            delete clients[userId];
            try {
                require('fs').rmSync(sessionPath, { recursive: true, force: true });
            } catch (e) { }
            // We can't easily recursively call initClient here without potential infinite loops, 
            // so we'll just log it. The user might need to click "Connect" again.
        }
    }

    return client;
};

const loadAllSessions = async (io) => {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);

    db.all(`SELECT user_id FROM sessions WHERE status = 'connected'`, async (err, rows) => {
        if (err) return console.error('Error loading sessions:', err);
        if (!rows) return;
        for (const row of rows) {
            console.log(`Auto-initializing session for user ${row.user_id}`);
            await initClient(row.user_id, io);
        }
    });
};

const sendMessage = async (userId, number, message) => {
    let client = clients[userId];

    if (!client) {
        console.log(`Client ${userId} not in memory, attempting to initialize...`);
        client = await initClient(userId);
    }

    console.log(`Checking readiness for user ${userId}. Current isReady: ${client.isReady}`);

    // Wait for client to be ready (max 60 seconds)
    let attempts = 0;
    while (!client.isReady && attempts < 60) {
        if (attempts % 5 === 0) console.log(`Waiting for user ${userId} to be ready... (${attempts}s)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }

    if (!client.isReady) {
        throw new Error(`WhatsApp is still initializing. Please wait a moment and try again.`);
    }

    const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    console.log(`Sending message to ${formattedNumber} for user ${userId}`);
    return await client.sendMessage(formattedNumber, message);
};

const disconnectClient = async (userId) => {
    const client = clients[userId];
    if (client) {
        try {
            // Only try to logout if the browser is actually running
            if (client.pupBrowser) {
                await client.logout().catch(() => { });
                await client.destroy().catch(() => { });
            }
        } catch (err) {
            console.error(`Error during logout for user ${userId}:`, err);
        }
        delete clients[userId];
    }

    const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-user-${userId}`);
    if (require('fs').existsSync(sessionPath)) {
        try {
            // Small delay to ensure browser process is closed
            await new Promise(resolve => setTimeout(resolve, 2000));
            require('fs').rmSync(sessionPath, { recursive: true, force: true });
        } catch (err) {
            console.error(`Error deleting session folder for user ${userId}:`, err);
        }
    }

    await Database.updateSessionStatus(userId, 'disconnected');
};

module.exports = {
    initClient,
    loadAllSessions,
    sendMessage,
    disconnectClient,
    getClient: (userId) => clients[userId]
};
