async function run() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: '123' })
        });
        
        const loginData = await loginRes.json();
        console.log('Login Status:', loginRes.status);
        console.log('Login Response:', loginData);
        
        if (!loginRes.ok) {
            console.error('Login failed!');
            process.exit(1);
        }

        const token = loginData.token;
        console.log('Acquired Token:', token);

        console.log('Fetching protected meta-templates...');
        const res = await fetch('http://localhost:5000/api/meta-templates', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await res.json();
        console.log('Fetch Status:', res.status);
        console.log('Fetch Response:', data);
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

run();
