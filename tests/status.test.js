/**
 * Project status auto-detection engine.
 *
 * The rules are the product's opinion about what "Live" or "In Development"
 * means, so the full matrix is pinned down here — including the boundaries.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_MS,
  MAINTAINED_DAYS,
  RECENT_DAYS,
  STATUS_TOPICS,
  daysSince,
  detectStatus,
  findStatusTopic,
  migrateLegacyStatus,
} from '../src/services/status.js';
import { REPO_STATUS_IDS } from '../src/config/app.js';

/** Fixed clock: 2024-06-01T00:00:00Z. */
const NOW = Date.UTC(2024, 5, 1);

/** Build a minimal repo `n` days before NOW. */
function repo({ days = 0, ...rest } = {}) {
  return {
    slug: 'me/thing',
    name: 'thing',
    archived: false,
    disabled: false,
    isFork: false,
    homepage: null,
    topics: [],
    updatedAt: new Date(NOW - days * DAY_MS).toISOString(),
    ...rest,
  };
}

describe('daysSince', () => {
  test('counts whole days and tolerates junk', () => {
    assert.equal(daysSince(new Date(NOW - 3 * DAY_MS).toISOString(), NOW), 3);
    assert.equal(daysSince(new Date(NOW - 3.9 * DAY_MS).toISOString(), NOW), 3);
    assert.equal(daysSince(null, NOW), null);
    assert.equal(daysSince('not a date', NOW), null);
    assert.equal(daysSince(undefined, NOW), null);
  });
});

describe('findStatusTopic', () => {
  test('recognises the documented topics', () => {
    assert.deepEqual(findStatusTopic(['status-live']), { topic: 'status-live', status: 'live' });
    assert.deepEqual(findStatusTopic(['status-mvp']), { topic: 'status-mvp', status: 'beta' });
    assert.deepEqual(findStatusTopic(['status-beta']), { topic: 'status-beta', status: 'beta' });
    assert.deepEqual(findStatusTopic(['status-paused']), { topic: 'status-paused', status: 'paused' });
    assert.deepEqual(findStatusTopic(['status-archived']), { topic: 'status-archived', status: 'paused' });
  });

  test('is case-insensitive and ignores unrelated topics', () => {
    assert.deepEqual(findStatusTopic(['Status-Live']), { topic: 'status-live', status: 'live' });
    assert.equal(findStatusTopic(['pdf', 'portfolio', 'statusish']), null);
    assert.equal(findStatusTopic(undefined), null);
    assert.equal(findStatusTopic(null), null);
  });

  test('every mapped topic is a real status', () => {
    for (const status of Object.values(STATUS_TOPICS)) {
      assert.ok(REPO_STATUS_IDS.includes(status), `"${status}" is not a known status`);
    }
  });
});

describe('detectStatus — spec rules', () => {
  test('archived → Paused / Archived', () => {
    const result = detectStatus(repo({ archived: true, days: 1 }), { now: NOW });
    assert.equal(result.status, 'paused');
    assert.equal(result.reason, 'archived');
  });

  test('topic status-archived / status-paused → Paused, even when freshly updated', () => {
    assert.equal(detectStatus(repo({ topics: ['status-archived'], days: 0 }), { now: NOW }).status, 'paused');
    assert.equal(detectStatus(repo({ topics: ['status-paused'], days: 0 }), { now: NOW }).status, 'paused');
  });

  test('topic status-live → Live, even with no homepage and no recent commits', () => {
    const result = detectStatus(repo({ topics: ['status-live'], days: 900, homepage: null }), { now: NOW });
    assert.equal(result.status, 'live');
    assert.equal(result.reason, 'topic');
    assert.equal(result.detail, 'status-live');
  });

  test('topic status-mvp / status-beta → Beta / MVP', () => {
    assert.equal(detectStatus(repo({ topics: ['status-mvp'] }), { now: NOW }).status, 'beta');
    assert.equal(detectStatus(repo({ topics: ['status-beta'] }), { now: NOW }).status, 'beta');
  });

  test('a homepage means Live — regardless of how old the last commit is', () => {
    const result = detectStatus(repo({ homepage: 'https://example.com', days: 800 }), { now: NOW });
    assert.equal(result.status, 'live');
    assert.equal(result.reason, 'homepage');
    assert.equal(result.detail, 'https://example.com');
  });

  test('updated within 30 days and no homepage → In Development', () => {
    const result = detectStatus(repo({ days: 5, homepage: null }), { now: NOW });
    assert.equal(result.status, 'development');
    assert.equal(result.reason, 'recent');
  });

  test('the 30-day boundary is exclusive', () => {
    assert.equal(detectStatus(repo({ days: RECENT_DAYS - 1 }), { now: NOW }).status, 'development');
    assert.equal(detectStatus(repo({ days: RECENT_DAYS }), { now: NOW }).status, 'beta');
  });
});

describe('detectStatus — priority', () => {
  test('an explicit topic beats the archived flag', () => {
    const result = detectStatus(repo({ archived: true, topics: ['status-live'] }), { now: NOW });
    assert.equal(result.status, 'live');
    assert.equal(result.reason, 'topic');
  });

  test('archived beats a homepage', () => {
    const result = detectStatus(repo({ archived: true, homepage: 'https://example.com' }), { now: NOW });
    assert.equal(result.status, 'paused');
    assert.equal(result.reason, 'archived');
  });

  test('a homepage beats recency', () => {
    const result = detectStatus(repo({ homepage: 'https://example.com', days: 1 }), { now: NOW });
    assert.equal(result.status, 'live');
  });

  test('disabled is treated like archived', () => {
    const result = detectStatus(repo({ disabled: true, days: 1 }), { now: NOW });
    assert.equal(result.status, 'paused');
    assert.equal(result.reason, 'disabled');
  });
});

describe('detectStatus — fallback tiers', () => {
  test('maintained within a year → Beta / MVP', () => {
    const result = detectStatus(repo({ days: 200 }), { now: NOW });
    assert.equal(result.status, 'beta');
    assert.equal(result.reason, 'maintained');
  });

  test('the one-year boundary puts a dormant repo into Paused', () => {
    assert.equal(detectStatus(repo({ days: MAINTAINED_DAYS }), { now: NOW }).status, 'beta');
    assert.equal(detectStatus(repo({ days: MAINTAINED_DAYS + 1 }), { now: NOW }).status, 'paused');
    assert.equal(detectStatus(repo({ days: MAINTAINED_DAYS + 1 }), { now: NOW }).reason, 'dormant');
  });

  test('a missing updatedAt falls back instead of throwing', () => {
    const result = detectStatus(repo({ updatedAt: null }), { now: NOW });
    assert.equal(result.reason, 'unknown');
    assert.ok(REPO_STATUS_IDS.includes(result.status));
  });

  test('every result carries a status, a source and a reason', () => {
    const cases = [
      repo({ archived: true }),
      repo({ homepage: 'https://x.dev' }),
      repo({ days: 1 }),
      repo({ days: 100 }),
      repo({ days: 900 }),
      repo({ topics: ['status-wip'] }),
    ];
    for (const candidate of cases) {
      const result = detectStatus(candidate, { now: NOW });
      assert.ok(REPO_STATUS_IDS.includes(result.status), `unknown status for ${JSON.stringify(candidate)}`);
      assert.ok(['auto', 'topic'].includes(result.source));
      assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    }
  });
});

describe('migrateLegacyStatus', () => {
  test('maps the previous six-status taxonomy onto the current four', () => {
    assert.equal(migrateLegacyStatus('showcase'), 'live');
    assert.equal(migrateLegacyStatus('active'), 'development');
    assert.equal(migrateLegacyStatus('wip'), 'development');
    assert.equal(migrateLegacyStatus('experiment'), 'beta');
    assert.equal(migrateLegacyStatus('legacy'), 'paused');
    assert.equal(migrateLegacyStatus('archived'), 'paused');
  });

  test('current and unknown values pass through untouched', () => {
    assert.equal(migrateLegacyStatus('live'), 'live');
    assert.equal(migrateLegacyStatus('nonsense'), 'nonsense');
    assert.equal(migrateLegacyStatus(null), null);
    assert.equal(migrateLegacyStatus(undefined), null);
  });
});
