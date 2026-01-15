require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pass socket.io to app to use in routes
app.set('socketio', io);

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const WhatsAppManager = require('./whatsapp-manager');

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await WhatsAppManager.loadAllSessions(io);
});
