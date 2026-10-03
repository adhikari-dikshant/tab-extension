import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeList, mergeScreenTimeDay, normalizeUrl, DEDUPE_KEYS, isMergeable } from '../src/lib/merge.ts'

const rec = (id, extra = {}) => ({ id, createdAt: 1000, updatedAt: 1000, ...extra })

test('cosmetic URL differences resolve to the same link identity', () => {
    const same = ['https://example.com', 'http://example.com/', 'https://WWW.Example.com', 'https://example.com//']
    const keys = new Set(same.map((url) => normalizeUrl(url)))
    assert.equal(keys.size, 1, [...keys].join(' != '))
    // Different paths and query strings stay distinct.
    assert.notEqual(normalizeUrl('https://example.com/a'), normalizeUrl('https://example.com/b'))
    assert.notEqual(normalizeUrl('https://example.com?a=1'), normalizeUrl('https://example.com'))
    assert.equal(normalizeUrl('not a url'), 'not a url')
    assert.equal(normalizeUrl(undefined), '')
})

test('the same link from another profile updates in place instead of duplicating', () => {
    const mine = [rec('local-1', { label: 'GitHub', url: 'https://github.com' })]
    const theirs = [rec('remote-9', { label: 'GitHub (work)', url: 'https://www.github.com/', updatedAt: 2000 })]
    const result = mergeList(mine, theirs, DEDUPE_KEYS.shortcuts)
    assert.equal(result.merged.length, 1)
    assert.equal(result.added, 0)
    assert.equal(result.updated, 1)
    assert.equal(result.merged[0].label, 'GitHub (work)', 'the newer copy wins')
    assert.equal(result.merged[0].id, 'local-1', 'the local id is kept so references stay valid')
})

test('an older incoming copy never overwrites a newer local one', () => {
    const mine = [rec('a', { text: 'Ship the thing', updatedAt: 5000 })]
    const theirs = [rec('a', { text: 'Ship the thign', updatedAt: 1000 })]
    const result = mergeList(mine, theirs, DEDUPE_KEYS.todos)
    assert.equal(result.merged[0].text, 'Ship the thing')
    assert.equal(result.unchanged, 1)
    assert.equal(result.updated, 0)
})

test('merging is idempotent and preserves existing order', () => {
    const mine = [rec('a', { url: 'https://a.com' }), rec('b', { url: 'https://b.com' })]
    const theirs = [rec('c', { url: 'https://c.com' }), rec('a2', { url: 'https://a.com' })]
    const once = mergeList(mine, theirs, DEDUPE_KEYS.shortcuts)
    assert.deepEqual(once.merged.map((r) => r.url), ['https://a.com', 'https://b.com', 'https://c.com'])
    const twice = mergeList(once.merged, theirs, DEDUPE_KEYS.shortcuts)
    assert.equal(twice.added, 0)
    assert.deepEqual(twice.merged.map((r) => r.url), once.merged.map((r) => r.url))
})

test('task dedupe keys separate recurring instances but merge identical wording', () => {
    const key = DEDUPE_KEYS.todos
    assert.equal(key({ text: 'Water   the Plants' }), key({ text: 'water the plants' }))
    assert.notEqual(key({ text: 'Standup', dueDate: '2026-10-01' }), key({ text: 'Standup', dueDate: '2026-10-02' }))
    assert.equal(key({ text: '  ' }), null, 'an empty task has no content key')
})

test('notes and workspaces match on content, not on title alone', () => {
    const notes = DEDUPE_KEYS.notes
    assert.equal(notes({ title: 'Ideas', body: 'one' }), notes({ title: 'ideas', body: 'ONE' }))
    assert.notEqual(notes({ title: 'Ideas', body: 'one' }), notes({ title: 'Ideas', body: 'two' }))
    assert.equal(notes({ title: '', body: '' }), null)

    const ws = DEDUPE_KEYS.workspaces
    // Tab order is irrelevant to which window a workspace restores.
    assert.equal(
        ws({ name: 'Work', tabs: [{ url: 'https://a.com' }, { url: 'https://b.com' }] }),
        ws({ name: 'work', tabs: [{ url: 'https://b.com/' }, { url: 'https://www.a.com' }] }),
    )
})

test('records with no content key fall back to id matching only', () => {
    const mine = [rec('a', { text: '' })]
    const result = mergeList(mine, [rec('b', { text: '' })], DEDUPE_KEYS.todos)
    assert.equal(result.merged.length, 2, 'two keyless records are two records')
})

test('equal timestamps resolve deterministically regardless of merge direction', () => {
    const left = rec('x', { label: 'A', url: 'https://x.com', createdAt: 100 })
    const right = rec('y', { label: 'B', url: 'https://x.com', createdAt: 200 })
    const forward = mergeList([left], [right], DEDUPE_KEYS.shortcuts).merged[0].label
    const backward = mergeList([right], [left], DEDUPE_KEYS.shortcuts).merged[0].label
    assert.equal(forward, 'A')
    assert.equal(backward, 'A', 'the earlier-created record wins either way')
})

test('screen-time days combine per domain without double-counting a re-import', () => {
    const mine = { totalSeconds: 100, domains: { 'a.com': 60, 'b.com': 40 }, lastUpdated: 5 }
    const theirs = { totalSeconds: 150, domains: { 'a.com': 90, 'c.com': 60 }, lastUpdated: 9 }
    const merged = mergeScreenTimeDay(mine, theirs)
    assert.deepEqual(merged.domains, { 'a.com': 90, 'b.com': 40, 'c.com': 60 })
    assert.equal(merged.totalSeconds, 150)
    assert.equal(merged.lastUpdated, 9)
    assert.deepEqual(mergeScreenTimeDay(merged, theirs), merged, 're-importing the same day changes nothing')
})

test('only the portable tier is mergeable', () => {
    assert.ok(isMergeable('todos'))
    assert.ok(isMergeable('notes'))
    assert.ok(!isMergeable('screentime:2026-09-14'), 'another machine’s history is not this one’s')
    assert.ok(!isMergeable('installId'))
    assert.ok(!isMergeable('weather:cache'))
    assert.ok(!isMergeable('whatever'))
})
