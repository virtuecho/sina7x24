import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaginationGuard } from './viewer-core.js';

function page(...ids) {
    return ids.map(id => ({ id }));
}

test('stops when the upstream response page stops advancing', () => {
    const inspect = createPaginationGuard();

    assert.equal(inspect({ requestedPage: 100, responsePage: 100, items: page(3, 2) }).shouldStop, false);

    const result = inspect({ requestedPage: 101, responsePage: 100, items: page(1, 0) });

    assert.equal(result.shouldStop, true);
    assert.equal(result.reason, 'response-page-stalled');
});

test('stops when the upstream repeats a non-empty page', () => {
    const inspect = createPaginationGuard();
    const items = page(3, 2, 1);

    assert.equal(inspect({ requestedPage: 1, responsePage: 1, items }).shouldStop, false);

    const result = inspect({ requestedPage: 2, responsePage: 2, items });

    assert.equal(result.shouldStop, true);
    assert.equal(result.reason, 'duplicate-page');
    assert.equal(result.fingerprintRepeated, true);
});

test('stops after the configured safety limit', () => {
    const inspect = createPaginationGuard({ maxPages: 2 });

    assert.equal(inspect({ requestedPage: 1, responsePage: 1, items: page(2) }).shouldStop, false);

    const result = inspect({ requestedPage: 2, responsePage: 2, items: page(1) });

    assert.equal(result.shouldStop, true);
    assert.equal(result.reason, 'max-pages');
});
