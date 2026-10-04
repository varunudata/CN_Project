const express = require('express');


const app = express()

app.use((req, res, next) => {
  res.set('X-Backend', 'B');
  next();
});

app.get('/' , (req , res) => {
    return res.send('Hi from backendB')
})

app.get('/api/data', (req, res) => {
  res.json({ message: 'hello from backend B', backend: 'B' });
});

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ backend: 'B', status: 'ok' });
});

app.get('/api/cached', (req, res) => {
    const etag = '"v1"';

    res.set('Cache-Control', 'public, max-age=60');
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
    }

    return res.json({
        message: 'Cached response from backendB'
    });
});

const port = Number(process.env.PORT) || 6000;

app.listen(port, '127.0.0.1', () => {
    console.log(`backendB listening on 127.0.0.1:${port}`)
})
