import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || '3001');
const resultsDir = path.join(__dirname, '../results');

app.use(express.static(path.join(__dirname, '../dashboard')));

app.get('/api/results', (req: Request, res: Response) => {
  if (!fs.existsSync(resultsDir)) {
    return res.json([]);
  }
  
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(resultsDir, f),
      timestamp: fs.statSync(path.join(resultsDir, f)).mtime,
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  res.json(files);
});

app.get('/api/results/:filename', (req: Request, res: Response) => {
  const filename = req.params.filename;
  const filePath = path.join(resultsDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  res.json(JSON.parse(content));
});

const server = app.listen(PORT, () => {
  console.log(`📊 Performance Dashboard running at http://localhost:${PORT}`);
  console.log(`📁 Results directory: ${resultsDir}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected to dashboard');
  
  ws.on('close', () => {
    console.log('Client disconnected from dashboard');
  });
});

fs.watch(resultsDir, { recursive: true }, (eventType, filename) => {
  if (filename && filename.endsWith('.json')) {
    console.log(`New result detected: ${filename}`);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'new-result', filename }));
      }
    });
  }
});
