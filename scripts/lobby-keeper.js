#!/usr/bin/env node
// Holds a 4v4 lobby until it is full. Project Reclaimer opens the map vote as
// soon as anyone is in the lobby and starts the winner with whoever is there;
// this cancels that vote while fewer than LOBBY_KEEPER_MIN_PLAYERS are in, and
// opens it again the moment the lobby fills.
//
// It talks to each server's remote console over WebSocket, inside Docker's
// network (see compose.yaml). RCON's ports are never published.

const MIN_PLAYERS = Number(process.env.LOBBY_KEEPER_MIN_PLAYERS || 8);
const POLL_MS = 2000;
const RECONNECT_MS = 5000;
const REPLY_TIMEOUT_MS = 5000;
// After a keeper restart it cannot know whether it cancelled the vote, so a
// full lobby sitting with no vote, no next game and no game this long is
// treated as one it was holding.
const UNKNOWN_HOLD_MS = 15000;

/**
 * What to do with one server, from its `status` reply. Pure, so the rules can
 * be tested without a server.
 *
 * state: { held: true | false | null, quietSince: ms | null, announced: n | null }
 * Returns { actions: [[command, ...args]], state }.
 */
function decide(status, state, now, min = MIN_PLAYERS) {
  const next = { ...state };
  const actions = [];
  const players = status.players || 0;
  const inLobby = status.phase === 'no_game';
  const ballotOpen = status.playlist_vote != null;

  if (!inLobby || players === 0) {
    // A game is on (an admin may have loaded one), or the lobby emptied and
    // Reclaimer will open a fresh vote when someone arrives.
    return { actions, state: { held: false, quietSince: null, announced: null } };
  }

  const fullAndQuiet = !ballotOpen && players >= min && status.next == null;

  if (ballotOpen && players < min) {
    // cancelvote ends a moderation vote first, so leave the lobby alone while
    // players are voting on a kick or a shuffle.
    if (status.vote == null) {
      actions.push(['cancelvote']);
      next.held = true;
    }
  } else if (fullAndQuiet && next.held === true) {
    actions.push(['startvote', 'playlist']);
    next.held = false;
  } else if (fullAndQuiet && next.held === null) {
    next.quietSince = next.quietSince ?? now;
    if (now - next.quietSince >= UNKNOWN_HOLD_MS) {
      actions.push(['startvote', 'playlist']);
      next.held = false;
    }
  }

  if (!(fullAndQuiet && next.held === null)) next.quietSince = null;

  if (next.held === true && players < min && next.announced !== players) {
    actions.push(['say', `Waiting for ${min} players before the map vote (${players}/${min}).`]);
    next.announced = players;
  }
  if (next.held === false) next.announced = null;

  return { actions, state: next };
}

class Server {
  constructor(host, port, password) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.state = { held: null, quietSince: null, announced: null };
    this.pending = new Map();
    this.nextId = 1;
    this.label = `${host}:${port}`;
  }

  log(msg) { console.log(`[${this.label}] ${msg}`); }

  connect() {
    const ws = new WebSocket(`ws://${this.host}:${this.port}/`);
    this.ws = ws;
    this.ready = false;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', password: this.password }));
    ws.onmessage = ev => this.onMessage(JSON.parse(ev.data));
    ws.onclose = () => {
      if (this.ready) this.log('disconnected');
      this.ready = false;
      for (const { reject } of this.pending.values()) reject(new Error('disconnected'));
      this.pending.clear();
      setTimeout(() => this.connect(), RECONNECT_MS);
    };
    ws.onerror = () => {};
  }

  onMessage(msg) {
    if (msg.type === 'auth') {
      if (msg.ok) {
        this.ready = true;
        if (msg.server) this.label = msg.server;
        this.log(`connected (Reclaimer ${msg.version})`);
      } else {
        this.log('wrong RCON password');
      }
    } else if (msg.type === 'reply' && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      msg.ok ? resolve(msg) : reject(new Error(msg.text || msg.error || 'command failed'));
    }
  }

  command(command, ...args) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ type: 'command', id, command, args }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${command}: no reply`));
      }, REPLY_TIMEOUT_MS);
    });
  }

  async tick() {
    if (!this.ready) return;
    try {
      const { data } = await this.command('status');
      const { actions, state } = decide(data, this.state, Date.now());
      this.state = state;
      for (const [command, ...args] of actions) {
        await this.command(command, ...args);
        if (command !== 'say') this.log(`${command} ${args.join(' ')} (${data.players}/${MIN_PLAYERS} players)`);
      }
    } catch (err) {
      this.log(err.message);
    }
  }
}

function main() {
  const password = process.env.RECLAIMER_DEDICATED_RCON_PASSWORD || '';
  const host = process.env.RCON_HOST || 'reclaimer';
  const ports = String(process.env.LOBBY_KEEPER_PORTS || '').split(/[\s,]+/).filter(Boolean).map(Number);
  if (!password || !ports.length) {
    console.log('lobby-keeper: off (needs RECLAIMER_DEDICATED_RCON_PASSWORD and LOBBY_KEEPER_PORTS in .env)');
    setInterval(() => {}, 1 << 30);
    return;
  }
  console.log(`lobby-keeper: holding ${ports.join(', ')} for ${MIN_PLAYERS} players`);
  for (const port of ports) {
    const server = new Server(host, port, password);
    server.connect();
    setInterval(() => server.tick(), POLL_MS);
  }
}

if (require.main === module) main();

module.exports = { decide, UNKNOWN_HOLD_MS };
