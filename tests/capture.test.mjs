import test from 'node:test'
import assert from 'node:assert/strict'
import { canCapture, cleanTitle, linkFromPage, noteFromPage, taskFromPage, captureMessage } from '../src/lib/capture.ts'
import { migrateRecord } from '../src/lib/migrations.ts'

globalThis.crypto ??= (await import('node:crypto')).webcrypto

test('only real web pages can be captured', () => {
    assert.ok(canCapture({ url: 'https://example.com' }))
    assert.ok(canCapture({ url: 'http://example.com' }))
    for (const url of ['chrome://settings', 'about:blank', 'file:///etc/passwd', 'javascript:alert(1)', '']) {
        assert.ok(!canCapture({ url }), `${url} should not be capturable`)
    }
    assert.ok(!canCapture(null))
})

test('page titles are trimmed of site suffixes but never emptied', () => {
    assert.equal(cleanTitle('How to Ship Software — Example News', 'https://example.com/a'), 'How to Ship Software')
    assert.equal(cleanTitle('Docs | Example', 'https://example.com'), 'Docs')
    // A head too short to be a real title keeps the whole thing instead.
    assert.equal(cleanTitle('Re — Example News', 'https://example.com'), 'Re — Example News')
    assert.equal(cleanTitle('   spaced    out   ', 'https://example.com'), 'spaced out')
    // No title at all falls back to the host rather than an empty task.
    assert.equal(cleanTitle(undefined, 'https://www.example.com/deep/path'), 'example.com')
    assert.equal(cleanTitle('', 'not a url'), 'not a url')
    assert.equal(cleanTitle('x'.repeat(500), 'https://example.com').length, 200)
})

test('a captured task records where it came from', () => {
    const task = taskFromPage({ url: 'https://example.com/post', title: 'A Post — Example' }, 4242)
    assert.equal(task.text, 'A Post')
    assert.deepEqual(task.source, { url: 'https://example.com/post', capturedAt: 4242, title: 'A Post — Example' })
    assert.equal(task.createdAt, 4242)
    assert.equal(task.updatedAt, 4242)
    assert.equal(task.done, false)
    assert.ok(task.id)
})

test('a captured note keeps the selection as its body', () => {
    const withSelection = noteFromPage({ url: 'https://example.com', title: 'Example', selection: '  the good part  ' }, 1)
    assert.equal(withSelection.body, 'the good part')
    assert.equal(withSelection.title, 'Example')
    assert.equal(withSelection.source.url, 'https://example.com')
    // No selection still produces a usable note, just an empty one to write into.
    assert.equal(noteFromPage({ url: 'https://example.com', title: 'Example' }, 1).body, '')
})

test('a captured link is a normal shortcut with provenance attached', () => {
    const link = linkFromPage({ url: 'https://example.com/tools', title: 'Tools' }, 9)
    assert.equal(link.label, 'Tools')
    assert.equal(link.url, 'https://example.com/tools')
    assert.equal(link.source.capturedAt, 9)
})

test('capture feedback names what was saved and whether a selection was used', () => {
    assert.match(captureMessage('capture-task', 'Thing', false), /task.*Thing/)
    assert.match(captureMessage('capture-note', 'Thing', true), /selection/)
    assert.doesNotMatch(captureMessage('capture-note', 'Thing', false), /selection/)
    assert.match(captureMessage('capture-link', 'Thing', false), /shortcut/)
})

test('legacy records are backfilled without inventing recency', () => {
    // A pre-versioning note had updatedAt but no createdAt.
    const note = migrateRecord({ id: 'n', title: 'x', updatedAt: 500 }, 0)
    assert.equal(note.createdAt, 500)
    assert.equal(note.updatedAt, 500)

    // A pre-versioning todo had createdAt only; a completion time is a better updatedAt estimate.
    assert.equal(migrateRecord({ id: 't', createdAt: 100 }, 0).updatedAt, 100)
    assert.equal(migrateRecord({ id: 't', createdAt: 100, lastCompletedAt: 900 }, 0).updatedAt, 900)

    // A shortcut had neither, so it sorts behind anything that does rather than looking brand new.
    const shortcut = migrateRecord({ id: 's', label: 'GitHub' }, 0)
    assert.equal(shortcut.createdAt, 0)
    assert.equal(shortcut.updatedAt, 0)
    assert.ok(shortcut.updatedAt < note.updatedAt, 'an undated record never outranks a dated one')

    // A record with no usable id gets one rather than colliding with another blank id on merge.
    assert.ok(migrateRecord({ title: 'no id' }, 0).id)
    assert.equal(migrateRecord({ id: 'keep', createdAt: 1 }, 0).id, 'keep')
})
