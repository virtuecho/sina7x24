import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_AUTO_REFRESH_SECONDS,
    normalizeAutoRefreshSeconds
} from './viewer-core.js';

test('keeps the refresh interval within a safe 24-hour limit', () => {
    assert.equal(MAX_AUTO_REFRESH_SECONDS, 24 * 60 * 60);
    assert.ok(MAX_AUTO_REFRESH_SECONDS * 1000 <= 2_147_483_647);
    assert.equal(normalizeAutoRefreshSeconds(MAX_AUTO_REFRESH_SECONDS), MAX_AUTO_REFRESH_SECONDS);
    assert.equal(normalizeAutoRefreshSeconds(MAX_AUTO_REFRESH_SECONDS + 1), null);
    assert.equal(normalizeAutoRefreshSeconds(2_147_484), null);
});

test('rejects invalid refresh interval values', () => {
    assert.equal(normalizeAutoRefreshSeconds(0), null);
    assert.equal(normalizeAutoRefreshSeconds('not-a-number'), null);
    assert.equal(normalizeAutoRefreshSeconds(Number.POSITIVE_INFINITY), null);
});
