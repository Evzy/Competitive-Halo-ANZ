#!/usr/bin/env node
const assert = require('assert');
const { decide, UNKNOWN_HOLD_MS } = require('./lobby-keeper');

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

const fresh = { held: null, quietSince: null, announced: null };
const lobby = (players, over = {}) => ({ phase: 'no_game', players, playlist_vote: null, vote: null, next: null, ...over });
const ballot = { games: [] };
const commands = r => r.actions.filter(a => a[0] !== 'say').map(a => a.join(' '));

test('cancels a ballot that opens with fewer than eight', () => {
  const r = decide(lobby(3, { playlist_vote: ballot }), fresh, 0, 8);
  assert.deepStrictEqual(commands(r), ['cancelvote']);
  assert.strictEqual(r.state.held, true);
});

test('tells the lobby how many it is waiting for, once per count', () => {
  let r = decide(lobby(3, { playlist_vote: ballot }), fresh, 0, 8);
  assert.deepStrictEqual(r.actions.find(a => a[0] === 'say'), ['say', 'Waiting for 8 players before the map vote (3/8).']);
  r = decide(lobby(3), r.state, 2000, 8);
  assert.strictEqual(r.actions.length, 0);
  r = decide(lobby(4), r.state, 4000, 8);
  assert.deepStrictEqual(r.actions, [['say', 'Waiting for 8 players before the map vote (4/8).']]);
});

test('opens the vote when a held lobby fills', () => {
  const held = { held: true, quietSince: null, announced: 7 };
  const r = decide(lobby(8), held, 0, 8);
  assert.deepStrictEqual(commands(r), ['startvote playlist']);
  assert.strictEqual(r.state.held, false);
});

test('leaves a full lobby voting alone', () => {
  const r = decide(lobby(8, { playlist_vote: ballot }), { ...fresh, held: false }, 0, 8);
  assert.deepStrictEqual(r.actions, []);
});

test('holds again if someone leaves during the vote', () => {
  const r = decide(lobby(7, { playlist_vote: ballot }), { ...fresh, held: false }, 0, 8);
  assert.deepStrictEqual(commands(r), ['cancelvote']);
});

test('never cancels while players are voting on a kick or shuffle', () => {
  const r = decide(lobby(3, { playlist_vote: ballot, vote: { subject: 'kick' } }), fresh, 0, 8);
  assert.deepStrictEqual(r.actions, []);
});

test('does nothing during a game', () => {
  const r = decide({ phase: 'in_game', players: 3, playlist_vote: null, vote: null, next: null }, { ...fresh, held: true }, 0, 8);
  assert.deepStrictEqual(r.actions, []);
  assert.strictEqual(r.state.held, false);
});

test('does not start a vote when the next game is already chosen', () => {
  const r = decide(lobby(8, { next: { map: 'Narrows' } }), { ...fresh, held: true }, 0, 8);
  assert.deepStrictEqual(r.actions, []);
});

test('an emptied lobby forgets it was held', () => {
  const r = decide(lobby(0), { held: true, quietSince: null, announced: 1 }, 0, 8);
  assert.strictEqual(r.state.held, false);
});

test('after a restart, a full quiet lobby gets its vote back only after waiting', () => {
  let r = decide(lobby(8), fresh, 0, 8);
  assert.deepStrictEqual(r.actions, []);
  r = decide(lobby(8), r.state, UNKNOWN_HOLD_MS - 1, 8);
  assert.deepStrictEqual(r.actions, []);
  r = decide(lobby(8), r.state, UNKNOWN_HOLD_MS, 8);
  assert.deepStrictEqual(commands(r), ['startvote playlist']);
});

test('after a restart, the wait restarts if the lobby changes', () => {
  let r = decide(lobby(8), fresh, 0, 8);
  r = decide(lobby(8, { playlist_vote: ballot }), r.state, 1000, 8);
  assert.strictEqual(r.state.quietSince, null);
});

if (!process.exitCode) console.log(`lobby-keeper: ${passed} tests passed`);
