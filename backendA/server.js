const express = require('express');


const app = express()

app.use((req, res, next) => {
  res.set('X-Backend', 'A');
  next();
});


app.get('/' , (req , res) => {
    return res.send('Hi from backendA')
})

app.get('/api/data', (req, res) => {
  res.json({ message: 'hello from backend A', backend: 'A' });
});

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ backend: 'A', status: 'ok' });
});

app.get('/api/cached', (req, res) => {
    const etag = '"v1"';

    res.set('Cache-Control', 'public, max-age=60');
    res.set('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
    }

    return res.json({
        message: 'Cached response from backendA'
    });
});

const port = Number(process.env.PORT) || 4000;

app.listen(port, '127.0.0.1', () => {
    console.log(`backendA listening on 127.0.0.1:${port}`);
});
