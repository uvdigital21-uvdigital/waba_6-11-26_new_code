import axios from 'axios';

async function testWebhookReachability() {
    const webhookUrl = 'https://janella-pseudoconservative-oversocially.ngrok-free.dev/webhook';
    console.log(`Testing reachability of Webhook URL: ${webhookUrl}`);
    
    try {
        // We call GET /webhook. If the server is up, it should respond.
        // It might return 403 because we don't supply verification tokens, which is expected.
        // What we want to check is if we get a response (server online) or a network error (server offline).
        const response = await axios.get(webhookUrl, {
            params: {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'wrong_token',
                'hub.challenge': 'test'
            },
            timeout: 5000
        });
        console.log(`✓ Webhook URL responded with HTTP Status: ${response.status}`);
        console.log('Response data:', response.data);
    } catch (err) {
        if (err.response) {
            console.log(`✓ Webhook URL is ONLINE. Responded with HTTP Status: ${err.response.status}`);
            console.log('Response data:', err.response.data);
        } else {
            console.error('❌ Webhook URL is OFFLINE or UNREACHABLE!');
            console.error('Error Details:', err.message);
        }
    }
    process.exit(0);
}

testWebhookReachability();
