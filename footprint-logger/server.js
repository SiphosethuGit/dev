const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// File-based storage (simpler than MongoDB for now)
const DATA_FILE = './users.json';

// Initialize data file
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], logs: [] }));
}

// Helper to read data
function readData() {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Register
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    const data = readData();
    
    if (data.users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'User exists' });
    }
    
    const user = { id: Date.now().toString(), email, password };
    data.users.push(user);
    writeData(data);
    
    res.json({ token: user.id, userId: user.id, email: user.email });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const data = readData();
    
    const user = data.users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    res.json({ token: user.id, userId: user.id, email: user.email });
});

// Get logs
app.get('/api/logs', (req, res) => {
    const token = req.headers['x-auth-token'];
    const data = readData();
    const userLogs = data.logs.filter(l => l.userId === token);
    res.json(userLogs);
});

// Add log
app.post('/api/logs', (req, res) => {
    const token = req.headers['x-auth-token'];
    const { activity, category, co2Value } = req.body;
    const data = readData();
    
    const newLog = {
        _id: Date.now().toString(),
        userId: token,
        activity,
        category,
        co2Value,
        date: new Date().toISOString()
    };
    
    data.logs.push(newLog);
    writeData(data);
    res.json(newLog);
});

// Delete log
app.delete('/api/logs/:id', (req, res) => {
    const token = req.headers['x-auth-token'];
    const logId = req.params.id;
    const data = readData();
    
    data.logs = data.logs.filter(l => !(l._id === logId && l.userId === token));
    writeData(data);
    res.json({ message: 'Deleted' });
});

// Insights
app.get('/api/logs/insights', (req, res) => {
    const token = req.headers['x-auth-token'];
    const data = readData();
    const userLogs = data.logs.filter(l => l.userId === token);
    
    if (userLogs.length === 0) {
        return res.json({
            tip: 'Add some activities to get insights!',
            totalCO2: 0,
            categoryTotals: { food: 0, transport: 0, energy: 0 }
        });
    }
    
    const categoryTotals = { food: 0, transport: 0, energy: 0 };
    userLogs.forEach(log => {
        categoryTotals[log.category] += log.co2Value;
    });
    
    let highestCategory = 'food';
    let highestValue = 0;
    for (const [cat, val] of Object.entries(categoryTotals)) {
        if (val > highestValue) {
            highestValue = val;
            highestCategory = cat;
        }
    }
    
    const totalCO2 = Object.values(categoryTotals).reduce((a,b) => a+b, 0);
    
    let tip = '';
    if (highestCategory === 'food') tip = '🥩 Try meatless Mondays to reduce food emissions!';
    else if (highestCategory === 'transport') tip = '🚗 Consider biking or public transit!';
    else tip = '💡 Turn off lights and unplug devices to save energy!';
    
    res.json({ tip, totalCO2, categoryTotals });
});

// Weekly summary
app.get('/api/logs/weekly-summary', (req, res) => {
    const token = req.headers['x-auth-token'];
    const data = readData();
    const userLogs = data.logs.filter(l => l.userId === token);
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekLogs = userLogs.filter(l => new Date(l.date) >= oneWeekAgo);
    const weeklyTotal = weekLogs.reduce((sum, l) => sum + l.co2Value, 0);
    const avgDaily = weeklyTotal / 7;
    
    res.json({ weeklyTotal, avgDaily });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});