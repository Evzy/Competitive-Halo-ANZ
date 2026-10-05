#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const { parseToml, checkPlaylist, checkMods, checkConfig, parsePortRange } = require('./validate');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL ${name}\n  ${err.message}`);
    process.exitCode = 1;
  }
}

const contentDir = path.join(__dirname, '..', 'server', 'content');
const file = path.join(__dirname, '..', 'server', 'playlists', 'test.playlist.json');
const opts = (over = {}) => ({ file, strict: true, gameModes: [], modMaps: new Set(), contentDir, ...over });
const game = (map, g, extra = {}) => ({ map, game: g, ...extra });
const three = [game('Guardian', 'Slayer'), game('The Pit', 'Slayer'), game('Narrows', 'Slayer')];

test('toml: tables, arrays of tables, comments and multi-line arrays', () => {
  const cfg = parseToml([
    'host_name = "A # not a comment" # a comment',
    'admins = [',
    '  "abc",  # first',
    '  "def",',
    ']',
    '[rcon]',
    'password = \'\'',
    '[[server]]',
    'name = "One"',
    'port = 49176',
    'enabled = false',
    '[[server]]',
    'name = "Two"',
  ].join('\n'));
  assert.strictEqual(cfg.host_name, 'A # not a comment');
  assert.deepStrictEqual(cfg.admins, ['abc', 'def']);
  assert.strictEqual(cfg.rcon.password, '');
  assert.strictEqual(cfg.server.length, 2);
  assert.strictEqual(cfg.server[0].port, 49176);
  assert.strictEqual(cfg.server[0].enabled, false);
});

test('toml: refuses what it cannot read rather than skipping it', () => {
  assert.throws(() => parseToml('when = 1979-05-27'), /unsupported value/);
  assert.throws(() => parseToml('[a.b]'), /cannot read/);
  assert.throws(() => parseToml('x = 1\nx = 2'), /set twice/);
});

test('playlist: a renamed copy of a game is still a repeat', () => {
  const r = checkPlaylist({ name: 'P', games: [...three, game('Guardian', 'slayer', { name: 'Other' })] }, opts());
  assert.ok(r.errors.some(e => /repeats game 1/.test(e)), r.errors.join('\n'));
});

test('playlist: different rules make a different game', () => {
  const r = checkPlaylist({ name: 'P', games: [...three, game('Guardian', 'Slayer', { rules: { score_to_win: 50 } })] }, opts());
  assert.deepStrictEqual(r.errors, []);
});

test('playlist: needs at least three games', () => {
  const r = checkPlaylist({ name: 'P', games: three.slice(0, 2) }, opts());
  assert.ok(r.errors.some(e => /3 to 128/.test(e)));
});

test('playlist: workshop references are refused', () => {
  const r = checkPlaylist({ name: 'P', games: [...three, game('workshop:123/arena', 'Slayer')] }, opts());
  assert.ok(r.errors.some(e => /workshop: reference/.test(e)));
});

test('playlist: a missing game type is an error only for an enabled server', () => {
  const games = [...three, game('Guardian', 'HARDCORE TS')];
  assert.ok(checkPlaylist({ name: 'P', games }, opts()).errors.some(e => /HARDCORE TS/.test(e)));
  const off = checkPlaylist({ name: 'P', games }, opts({ strict: false }));
  assert.deepStrictEqual(off.errors, []);
  assert.ok(off.warnings.some(w => /HARDCORE TS/.test(w)));
});

test('playlist: a game type with a matching file resolves', () => {
  const r = checkPlaylist({ name: 'P', games: [...three, game('Guardian', 'HARDCORE TS')] }, opts({ gameModes: ['hardcore ts'] }));
  assert.deepStrictEqual(r.errors, []);
});

test('playlist: a missing content file is an error only for an enabled server', () => {
  const games = [...three, game('Maps/Nope 8.mvar', 'Game Modes/Nope 8.bin')];
  const on = checkPlaylist({ name: 'P', games }, opts());
  assert.ok(on.errors.some(e => /Maps\/Nope 8\.mvar/.test(e)) && on.errors.some(e => /Game Modes\/Nope 8\.bin/.test(e)), on.errors.join('\n'));
  const off = checkPlaylist({ name: 'P', games }, opts({ strict: false }));
  assert.deepStrictEqual(off.errors, []);
  assert.strictEqual(off.warnings.length, 2);
});

test('playlist: a mod map resolves through mods.json', () => {
  const games = [...three, game('MLG Warlock', 'Slayer')];
  assert.ok(checkPlaylist({ name: 'P', games }, opts()).errors.length);
  assert.deepStrictEqual(checkPlaylist({ name: 'P', games }, opts({ modMaps: new Set(['mlg warlock']) })).errors, []);
});

test('mods: every entry is attributed', () => {
  assert.deepStrictEqual(checkMods({ mods: [] }), []);
  const errs = checkMods({ mods: [{ id: '2977651586', name: 'Warlock', maps: ['MLG Warlock'] }] });
  assert.ok(errs.some(e => /author/.test(e)) && errs.some(e => /url/.test(e)));
  assert.ok(checkMods({ mods: [{ id: 'abc' }] }).some(e => /Workshop item number/.test(e)));
});

test('config: secrets in the file are refused', () => {
  const errs = checkConfig({ rcon: { password: 'hunter22' }, server: [{ name: 'A', port: 49176, password: 'x' }] }, { gamePorts: [49176, 49177] });
  assert.ok(errs.some(e => /\[rcon\] password/.test(e)));
  assert.ok(errs.some(e => /server 1.*password/.test(e)));
});

test('config: an enabled server outside GAME_PORTS would not be published', () => {
  const cfg = { server: [{ name: 'A', port: 49176 }, { name: 'B', port: 49180 }] };
  assert.ok(checkConfig(cfg, { gamePorts: [49176, 49177] }).some(e => /49180 is outside GAME_PORTS/.test(e)));
  cfg.server[1].enabled = false;
  assert.deepStrictEqual(checkConfig(cfg, { gamePorts: [49176, 49177] }), []);
});

test('config: duplicate names and ports, and the master port', () => {
  const errs = checkConfig({ server: [
    { name: 'A', port: 49176 }, { name: 'a', port: 49177 }, { name: 'C', port: 49176 }, { name: 'D', port: 49175 },
  ] }, { gamePorts: [49175, 49177] });
  assert.ok(errs.some(e => /name used twice/.test(e)));
  assert.ok(errs.some(e => /49176 already in use/.test(e)));
  assert.ok(errs.some(e => /49175 already in use/.test(e)));
});

test('ports: ranges parse and nonsense does not', () => {
  assert.deepStrictEqual(parsePortRange('49176-49177'), [49176, 49177]);
  assert.deepStrictEqual(parsePortRange('49176'), [49176, 49176]);
  assert.strictEqual(parsePortRange('49177-49176'), null);
  assert.strictEqual(parsePortRange(''), null);
});

console.log(`${passed} passed`);
