import assert from 'node:assert/strict';
import test from 'node:test';

import { redactMessage as server } from '../server/redact.mjs';
import { redactMessage as client } from '../src/platform/redact.ts';

const CASES: [string, unknown, string][] = [
  ['plain messages pass through', 'TypeError: x is not a function', 'TypeError: x is not a function'],
  [
    'page URLs and their query strings go',
    'Failed to load https://korupsi.web.id/?seed=12&token=abc at line 3',
    'Failed to load <url> at line 3',
  ],
  [
    'extension IDs go',
    'Uncaught Error at chrome-extension://abcdefghijklmnop/content.js:10:4',
    'Uncaught Error at <url>',
  ],
  ['inline URIs go', 'Refused to load data:image/png;base64,AAAA', 'Refused to load <url>'],
  ['blob URLs go', 'Not allowed: blob:https://korupsi.web.id/1234-5678', 'Not allowed: <url>'],
  ['addresses without a scheme go', 'Cannot reach www.example.com/path?q=1 now', 'Cannot reach <url> now'],
  ['email addresses go', 'User someone.name+tag@mail.example.org not found', 'User <email> not found'],
  ['only the first line is kept', 'Error: boom\n    at https://korupsi.web.id/assets/index.js:1:2', 'Error: boom'],
  ['whitespace collapses', '  a\t\t b  ', 'a b'],
  ['non-strings become text', 42, '42'],
  ['nothing stays nothing', undefined, ''],
  ['dotted names without a path stay', 'game.player.onGround is null', 'game.player.onGround is null'],
];

for (const [name, input, expected] of CASES) {
  test(`redact: ${name}`, () => {
    assert.equal(client(input), expected, 'client');
    assert.equal(server(input), expected, 'server');
  });
}

test('redact: long messages are clipped to 300 characters', () => {
  assert.equal(client('x'.repeat(1000)).length, 300);
  assert.equal(server('x'.repeat(1000)).length, 300);
});
