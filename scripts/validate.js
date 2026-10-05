#!/usr/bin/env node
// Checks the server config, playlists and mod manifest before a pull request
// merges. `dedicated check` on a real server is still the authority: it has the
// game files and can read inside a .bin, and this cannot. What this catches is
// everything that can be decided from the repo alone, on every PR, with no game
// install and no dependencies.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

// Halo 3's multiplayer maps by title. Reclaimer also accepts file names
// ("riverworld"); this repo uses titles so a reader knows the map on sight.
const BASE_MAPS = [
  'Assembly', 'Avalanche', 'Blackout', 'Citadel', 'Cold Storage', 'Construct',
  'Epitaph', 'Foundry', 'Ghost Town', 'Guardian', 'Heretic', 'High Ground',
  'Isolation', 'Last Resort', 'Longshore', 'Narrows', 'Orbital', "Rat's Nest",
  'Sandbox', 'Sandtrap', 'Snowbound', 'Standoff', 'The Pit', 'Valhalla',
];

const BASE_MODES = [
  'Slayer', 'Capture the Flag', 'King of the Hill', 'Oddball', 'Assault',
  'Territories', 'Juggernaut', 'Infection', 'VIP',
  // Scripted modes the server installs into content/Game Modes on first start.
  'Gun Game', 'Growth', 'One in the Chamber', 'Zone Control', 'Flood Infection',
];

const TEAM_CHANGING = ['balanced', 'game_type', 'off'];
const MOD_MAPS_PER_PLAYLIST = 23;

// ── A TOML reader for the subset dedicated.toml uses ───────────────────────
// Tables, arrays of tables, strings, integers, booleans and arrays of those.
// Anything else throws rather than being misread: a validator that quietly
// skips a line it does not understand passes the config it was meant to stop.

function parseValue(src, lineNo) {
  const s = src.trim();
  if (s.startsWith('"')) {
    const m = s.match(/^"((?:[^"\\]|\\.)*)"$/);
    if (!m) throw new Error(`line ${lineNo}: unterminated string`);
    return JSON.parse(`"${m[1]}"`);
  }
  if (s.startsWith("'")) {
    const m = s.match(/^'([^']*)'$/);
    if (!m) throw new Error(`line ${lineNo}: unterminated literal string`);
    return m[1];
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
  if (s.startsWith('[')) {
    if (!s.endsWith(']')) throw new Error(`line ${lineNo}: unterminated array`);
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).filter(x => x.trim()).map(x => parseValue(x, lineNo));
  }
  throw new Error(`line ${lineNo}: unsupported value ${s}`);
}

function splitTopLevel(s) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"') { cur += s[++i]; continue; }
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") { quote = c; cur += c; }
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') { i++; continue; }
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '#') return line.slice(0, i);
  }
  return line;
}

function parseToml(text) {
  const root = {};
  let target = root;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = stripComment(lines[i]).trim();
    if (!line) continue;

    let m = line.match(/^\[\[([A-Za-z0-9_]+)\]\]$/);
    if (m) {
      root[m[1]] = root[m[1]] || [];
      if (!Array.isArray(root[m[1]])) throw new Error(`line ${lineNo}: [[${m[1]}]] clashes with a table`);
      target = {};
      root[m[1]].push(target);
      continue;
    }
    m = line.match(/^\[([A-Za-z0-9_]+)\]$/);
    if (m) {
      if (root[m[1]]) throw new Error(`line ${lineNo}: [${m[1]}] defined twice`);
      target = root[m[1]] = {};
      continue;
    }
    m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) throw new Error(`line ${lineNo}: cannot read "${line}"`);
    let value = m[2];
    // A multi-line array runs until its closing bracket.
    if (value.trim().startsWith('[') && !value.trim().endsWith(']')) {
      while (++i < lines.length) {
        value += ' ' + stripComment(lines[i]).trim();
        if (value.trim().endsWith(']')) break;
      }
    }
    if (m[1] in target) throw new Error(`line ${lineNo}: ${m[1]} set twice`);
    target[m[1]] = parseValue(value, lineNo);
  }
  return root;
}

// ── Checks ──────────────────────────────────────────────────────────────────

function lower(s) { return String(s).toLowerCase(); }

function sortedJson(v) {
  if (Array.isArray(v)) return `[${v.map(sortedJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${sortedJson(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(typeof v === 'string' ? v.toLowerCase() : v);
}

function gameModeFiles(contentDir) {
  const dir = path.join(contentDir, 'Game Modes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(bin|json)$/i.test(f))
    .map(f => lower(path.parse(f).name));
}

function modMapNames(mods) {
  return new Set(mods.flatMap(m => m.maps || []).map(lower));
}

/**
 * Checks one playlist. `strict` is true when an enabled server uses it: a map
 * or game type this repo cannot account for is then an error rather than a
 * note, because that server would refuse to start on the host.
 */
function checkPlaylist(playlist, { file, strict, gameModes, modMaps, contentDir }) {
  const errors = [];
  const warnings = [];
  const where = path.relative(ROOT, file);
  const unresolved = strict ? errors : warnings;

  if (typeof playlist.name !== 'string' || !playlist.name.trim()) errors.push(`${where}: needs a name`);
  if (playlist.vote_seconds !== undefined
      && !(Number.isInteger(playlist.vote_seconds) && playlist.vote_seconds >= 5 && playlist.vote_seconds <= 120)) {
    errors.push(`${where}: vote_seconds must be 5 to 120`);
  }
  const games = playlist.games;
  if (!Array.isArray(games) || games.length < 3 || games.length > 128) {
    errors.push(`${where}: needs 3 to 128 games`);
    return { errors, warnings };
  }

  const baseMaps = new Set(BASE_MAPS.map(lower));
  const baseModes = new Set(BASE_MODES.map(lower));
  const seen = new Map();
  const modMapsUsed = new Set();

  games.forEach((g, i) => {
    const at = `${where} game ${i + 1}`;
    if (typeof g.map !== 'string' || typeof g.game !== 'string') {
      errors.push(`${at}: needs map and game`);
      return;
    }
    if (g.weight !== undefined && !(Number.isInteger(g.weight) && g.weight >= 1 && g.weight <= 100)) {
      errors.push(`${at}: weight must be a whole number 1 to 100`);
    }

    // A renamed but otherwise identical game is still a repeat to Reclaimer.
    const key = sortedJson({ map: g.map, game: g.game, rules: g.rules || {}, options: g.options || {} });
    if (seen.has(key)) errors.push(`${at}: repeats game ${seen.get(key)}; raise its weight instead`);
    else seen.set(key, i + 1);

    const map = g.map;
    if (lower(map).startsWith('workshop:')) {
      errors.push(`${at}: "${map}" - name mod maps by map name; a workshop: reference fails in Docker, which has no Steam`);
    } else if (/^maps\//i.test(map)) {
      if (!fs.existsSync(path.join(contentDir, map))) errors.push(`${at}: ${map} is not in server/content`);
    } else if (!baseMaps.has(lower(map))) {
      if (modMaps.has(lower(map))) modMapsUsed.add(lower(map));
      else unresolved.push(`${at}: map "${map}" is neither a Halo 3 map nor in mods.json`);
    }

    const game = g.game;
    if (/^game modes\//i.test(game)) {
      if (!fs.existsSync(path.join(contentDir, game))) errors.push(`${at}: ${game} is not in server/content`);
    } else if (!baseModes.has(lower(game)) && !gameModes.includes(lower(game))) {
      unresolved.push(`${at}: game type "${game}" has no file in server/content/Game Modes`);
    }
  });

  if (modMapsUsed.size > MOD_MAPS_PER_PLAYLIST) {
    errors.push(`${where}: uses ${modMapsUsed.size} mod maps; Reclaimer allows ${MOD_MAPS_PER_PLAYLIST}`);
  }
  return { errors, warnings };
}

function checkMods(manifest) {
  const errors = [];
  if (!manifest || !Array.isArray(manifest.mods)) return ['mods.json: needs a "mods" array'];
  const ids = new Set();
  manifest.mods.forEach((m, i) => {
    const at = `mods.json entry ${i + 1}`;
    if (!/^\d+$/.test(String(m.id || ''))) errors.push(`${at}: id must be the Workshop item number`);
    else if (ids.has(String(m.id))) errors.push(`${at}: id ${m.id} listed twice`);
    else ids.add(String(m.id));
    for (const field of ['name', 'author', 'url']) {
      if (typeof m[field] !== 'string' || !m[field].trim()) errors.push(`${at}: needs ${field}`);
    }
    if (!Array.isArray(m.maps) || !m.maps.length || !m.maps.every(x => typeof x === 'string' && x.trim())) {
      errors.push(`${at}: needs maps, the map names playlists use`);
    }
  });
  return errors;
}

function parsePortRange(spec) {
  const m = String(spec || '').trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = m[2] ? parseInt(m[2], 10) : lo;
  return lo <= hi ? [lo, hi] : null;
}

function envExampleValue(text, name) {
  const m = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

function checkConfig(cfg, { gamePorts }) {
  const errors = [];
  const servers = cfg.server || [];
  if (!servers.length) errors.push('dedicated.toml: no [[server]] blocks');

  if (cfg.rcon && cfg.rcon.password) errors.push('dedicated.toml: [rcon] password is set; put it in .env');
  if (cfg.defaults && cfg.defaults.password) errors.push('dedicated.toml: [defaults] password is set; put it in .env');

  const masterPort = (cfg.master && cfg.master.port) || 49175;
  const names = new Set();
  const ports = new Set();
  for (const [i, s] of servers.entries()) {
    const at = `dedicated.toml server ${i + 1}${s.name ? ` (${s.name})` : ''}`;
    if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 48) errors.push(`${at}: name is required, up to 48 characters`);
    else if (names.has(lower(s.name))) errors.push(`${at}: name used twice`);
    else names.add(lower(s.name));

    if (!Number.isInteger(s.port) || s.port < 1024 || s.port > 65535) errors.push(`${at}: port must be 1024 to 65535`);
    else if (ports.has(s.port) || s.port === masterPort) errors.push(`${at}: port ${s.port} already in use`);
    else ports.add(s.port);

    if (s.password) errors.push(`${at}: password is set; put it in .env`);
    if (s.rcon_password) errors.push(`${at}: rcon_password is set; put it in .env`);

    const sources = [s.playlist !== undefined, s.map !== undefined || s.game !== undefined, s.variant !== undefined]
      .filter(Boolean).length;
    if (sources > 1) errors.push(`${at}: choose one of playlist, map + game, or variant`);
    if ((s.map === undefined) !== (s.game === undefined)) errors.push(`${at}: map and game go together`);

    if (s.max_players !== undefined && !(Number.isInteger(s.max_players) && s.max_players >= 1 && s.max_players <= 63)) {
      errors.push(`${at}: max_players must be 1 to 63`);
    }
    if (s.team_changing !== undefined && !TEAM_CHANGING.includes(s.team_changing)) {
      errors.push(`${at}: team_changing must be one of ${TEAM_CHANGING.join(', ')}`);
    }

    const enabled = s.enabled !== false;
    if (enabled && gamePorts && Number.isInteger(s.port) && (s.port < gamePorts[0] || s.port > gamePorts[1])) {
      errors.push(`${at}: port ${s.port} is outside GAME_PORTS ${gamePorts.join('-')} in .env.example, so Docker would not publish it`);
    }
  }
  return errors;
}

function findForbiddenFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    // Present on a host, gitignored, and absent from a CI checkout.
    if (rel === 'server/game' || rel === 'server/content/Mods' || rel === 'server/data') continue;
    if (entry.isDirectory()) findForbiddenFiles(full, found);
    else if (/\.(map|dll|exe)$/i.test(entry.name)) found.push(rel);
  }
  return found;
}

function main() {
  const errors = [];
  const warnings = [];
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

  let cfg;
  try {
    cfg = parseToml(read('server/dedicated.toml'));
  } catch (err) {
    console.error(`dedicated.toml: ${err.message}`);
    process.exit(1);
  }

  let mods;
  try {
    mods = JSON.parse(read('mods.json'));
  } catch (err) {
    console.error(`mods.json: ${err.message}`);
    process.exit(1);
  }
  errors.push(...checkMods(mods));

  const gamePorts = parsePortRange(envExampleValue(read('.env.example'), 'GAME_PORTS'));
  if (!gamePorts) errors.push('.env.example: GAME_PORTS must be a port or a range like 49176-49177');
  errors.push(...checkConfig(cfg, { gamePorts }));

  const contentDir = path.join(SERVER, cfg.content || 'content');
  const gameModes = gameModeFiles(contentDir);
  const modMaps = modMapNames(mods.mods || []);

  const enabledPlaylists = new Set(
    (cfg.server || []).filter(s => s.enabled !== false && s.playlist).map(s => path.resolve(SERVER, s.playlist)),
  );
  for (const s of cfg.server || []) {
    if (s.playlist && !fs.existsSync(path.resolve(SERVER, s.playlist))) {
      errors.push(`dedicated.toml (${s.name}): playlist ${s.playlist} does not exist`);
    }
  }

  const readme = read('README.md');
  const playlistDir = path.join(SERVER, 'playlists');
  for (const f of fs.readdirSync(playlistDir).filter(f => f.endsWith('.playlist.json'))) {
    const file = path.join(playlistDir, f);
    let playlist;
    try {
      playlist = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push(`${path.relative(ROOT, file)}: ${err.message}`);
      continue;
    }
    const r = checkPlaylist(playlist, { file, strict: enabledPlaylists.has(file), gameModes, modMaps, contentDir });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    if (!readme.includes(f)) errors.push(`README.md does not list playlists/${f}`);
  }

  for (const f of findForbiddenFiles(ROOT)) {
    errors.push(`${f}: map, engine and program files are never committed`);
  }

  for (const w of warnings) console.log(`note   ${w}`);
  for (const e of errors) console.log(`error  ${e}`);
  if (errors.length) {
    console.log(`\n${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`\nOK${warnings.length ? `, ${warnings.length} note(s) for disabled servers` : ''}.`);
}

if (require.main === module) main();

module.exports = { parseToml, checkPlaylist, checkMods, checkConfig, parsePortRange };
