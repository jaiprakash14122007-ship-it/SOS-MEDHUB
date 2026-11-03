require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FAST2SMS_KEY = process.env.FAST2SMS_KEY || '';

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Tells the frontend whether automatic SMS is available
app.get('/api/config', (req, res) => {
  res.json({ smsReady: Boolean(FAST2SMS_KEY) });
});

// Sends the emergency SMS through Fast2SMS
app.post('/api/sms', async (req, res) => {
  if (!FAST2SMS_KEY) {
    return res.status(503).json({ return: false, message: 'SMS key not configured on server' });
  }

  const { numbers, message } = req.body || {};

  if (!Array.isArray(numbers) || numbers.length === 0 || numbers.length > 10) {
    return res.status(400).json({ return: false, message: 'Provide 1-10 phone numbers' });
  }
  const clean = numbers.map(n => String(n).replace(/\D/g, '').slice(-10));
  if (clean.some(n => n.length !== 10)) {
    return res.status(400).json({ return: false, message: 'Each number must be 10 digits' });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ return: false, message: 'Message is required' });
  }

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: FAST2SMS_KEY,
        'Content-Type': 'application/json',
        'cache-control': 'no-cache'
      },
      body: JSON.stringify({
        route: 'q',
        message: message.slice(0, 160),
        language: 'english',
        flash: 0,
        numbers: clean.join(',')
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Fast2SMS error:', err.message);
    res.status(502).json({ return: false, message: 'Could not reach SMS provider' });
  }
});

app.listen(PORT, () => {
  console.log(`MEDHUB running at http://localhost:${PORT}`);
  console.log(FAST2SMS_KEY ? 'SMS: enabled' : 'SMS: no key set (fallback mode)');
});
