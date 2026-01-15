const socket = io();

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

const welcomeMsg = document.getElementById('welcome-msg');
const userIdDisplay = document.getElementById('user-id-display');
const appSecretDisplay = document.getElementById('app-secret-display');
const userIdParam = document.getElementById('user-id-param');


const statusBadge = document.getElementById('status-badge');
const initBtn = document.getElementById('init-btn');
const disconnectBtn = document.getElementById('disconnect-btn'); // This is the one inside status section
const logoutWaBtn = document.getElementById('logout-wa-btn'); // This is the one in header
const qrContainer = document.getElementById('qr-container');
const qrCodeImg = document.getElementById('qr-code');
const logoutBtn = document.getElementById('logout-btn');

const testApiSection = document.getElementById('test-api-section');
const testMsgForm = document.getElementById('test-msg-form');
const testResult = document.getElementById('test-result');
const sendTestBtn = document.getElementById('send-test-btn');

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user'));

if (token && user) {
    showDashboard();
}

// Removed toggleForm logic as registration is disabled


loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            token = data.token;
            user = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            showDashboard();
        } else {
            loginError.textContent = data.error;
        }
    } catch (err) {
        loginError.textContent = 'Login failed';
    }
});

function showDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');

    welcomeMsg.textContent = `Welcome, ${user.username}`;
    userIdDisplay.textContent = user.id;
    appSecretDisplay.textContent = user.app_secret;
    userIdParam.textContent = user.id;


    checkStatus();
    setupSocket();
}


async function checkStatus() {
    const res = await fetch('/api/status', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    updateStatusUI(data.status);
}

function updateStatusUI(status) {
    statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusBadge.className = `badge ${status}`;

    if (status === 'connected') {
        initBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        if (logoutWaBtn) logoutWaBtn.classList.remove('hidden');
        qrContainer.classList.add('hidden');
        testApiSection.classList.remove('hidden');
    } else if (status === 'qr_ready') {
        initBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        if (logoutWaBtn) logoutWaBtn.classList.add('hidden');
        qrContainer.classList.remove('hidden');
        testApiSection.classList.add('hidden');
    } else {
        initBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
        if (logoutWaBtn) logoutWaBtn.classList.add('hidden');
        qrContainer.classList.add('hidden');
        testApiSection.classList.add('hidden');
    }
}

testMsgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('test-number').value;
    const message = document.getElementById('test-message').value;

    sendTestBtn.textContent = 'Sending...';
    sendTestBtn.disabled = true;
    testResult.textContent = '';
    testResult.style.color = 'var(--primary)';

    try {
        const res = await fetch(`/api/sent/${user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                app_secret: user.app_secret,
                number,
                message
            })
        });
        const data = await res.json();

        if (data.success) {
            testResult.textContent = 'Message sent successfully!';
        } else {
            testResult.style.color = 'var(--error)';
            testResult.textContent = 'Error: ' + data.error;
        }
    } catch (err) {
        testResult.style.color = 'var(--error)';
        testResult.textContent = 'Failed to send message';
    } finally {
        sendTestBtn.textContent = 'Send Test Message';
        sendTestBtn.disabled = false;
    }
});

initBtn.addEventListener('click', async () => {
    initBtn.textContent = 'Initializing...';
    initBtn.disabled = true;
    await fetch('/api/init', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
});

disconnectBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp? This will clear your session.')) return;

    disconnectBtn.textContent = 'Disconnecting...';
    disconnectBtn.disabled = true;

    try {
        const res = await fetch('/api/disconnect', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            location.reload();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Failed to disconnect');
    } finally {
        disconnectBtn.textContent = 'Disconnect WhatsApp';
        disconnectBtn.disabled = false;
    }
});

// Header Logout WhatsApp Button
if (logoutWaBtn) {
    logoutWaBtn.addEventListener('click', () => {
        disconnectBtn.click();
    });
}

function setupSocket() {
    socket.on(`qr-${user.id}`, (qrDataURL) => {
        qrCodeImg.src = qrDataURL;
        updateStatusUI('qr_ready');
    });

    socket.on(`ready-${user.id}`, () => {
        updateStatusUI('connected');
    });
}

logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});
