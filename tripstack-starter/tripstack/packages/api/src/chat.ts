export class ChatRoom implements DurableObject {
  sessions: WebSocket[] = [];
  constructor(readonly state: DurableObjectState) {}
  async fetch(req: Request) {
    if (req.headers.get('upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]] as unknown as [WebSocket, WebSocket];
      this.handle(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }
  handle(ws: WebSocket) {
    ws.accept();
    this.sessions.push(ws);
    ws.addEventListener('message', (e) => this.broadcast(String(e.data)));
    ws.addEventListener('close', () => this.sessions = this.sessions.filter(s => s !== ws));
  }
  broadcast(msg: string) { for (const s of this.sessions) if (s.readyState === 1) s.send(msg); }
}
