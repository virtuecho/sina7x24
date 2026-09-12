import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml, getSafeHttpUrl } from '../scripts/core/viewer-core.js';

globalThis.window = { location: { href: 'https://viewer.example/' } };

assert.equal(
    escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;'
);
assert.equal(escapeHtml('正常新浪新闻'), '正常新浪新闻');
assert.equal(getSafeHttpUrl('https://finance.sina.com.cn/news'), 'https://finance.sina.com.cn/news');
assert.equal(getSafeHttpUrl('javascript:alert(1)'), null);
assert.equal(getSafeHttpUrl('data:text/html,test'), null);

const source = await readFile(new URL('../scripts/core/viewer-core.js', import.meta.url), 'utf8');
for (const value of ['displayParts.title', 'displayParts.body', 'item.id', 'formatTime(item.create_time)', 't.name']) {
    assert.match(source, new RegExp(`escapeHtml\\(${value.replace(/[().]/g, '\\$&')}\\)`));
}
assert.match(source, /\.map\(getSafeHttpUrl\)/);
assert.match(source, /const safeUrl = getSafeHttpUrl\(url\)/);

console.log('Viewer renderer XSS checks passed.');
