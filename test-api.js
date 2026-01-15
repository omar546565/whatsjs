const axios = require('axios');

async function testSendMessage() {
    const url = "http://localhost:3011/api/sent/1";
    const payload = {
        user_id: "1",
        app_secret: "YOUR_APP_SECRET_HERE", // Replace with secret from dashboard
        number: '9050000000', // Replace with real number
        message: 'hi from API'
    };

    try {
        const response = await axios.post(url, payload);
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testSendMessage();
