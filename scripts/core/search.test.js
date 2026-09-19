import assert from 'node:assert/strict';
import test from 'node:test';
import { getSearchableTextParts } from './viewer-core.js';

test('indexes tags and comment fields for search', () => {
    const text = getSearchableTextParts({
        id: 123,
        rich_text: '正文',
        tag: [{ id: 7, name: '市场' }],
        comment_list: {
            list: [{
                nick: '富拉尔基第一鲁班',
                content: '评论正文',
                area: '黑龙江'
            }]
        }
    }).join(' ').toLowerCase();

    assert.match(text, /市场/);
    assert.match(text, /富拉尔基第一鲁班/);
    assert.match(text, /评论正文/);
    assert.match(text, /黑龙江/);
});

test('ignores malformed tag and comment arrays', () => {
    assert.doesNotThrow(() => getSearchableTextParts({
        tag: { id: 7, name: '市场' },
        comment_list: { list: { nick: '不会崩溃' } }
    }));
});
