import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateSettings } from '../src/lib/migrations.ts'
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '../src/lib/storage.ts'

test('upgrading switches on widgets added since the stored version', () => {
    // Settings written before `notes`/`workspaces` existed: no version marker at all.
    const before = { widgetsEnabled: ['shortcuts', 'todo', 'clock'], cardOrder: ['shortcuts', 'todo', 'mostVisited'] }
    const after = migrateSettings(before)
    assert.ok(after.widgetsEnabled.includes('notes'))
    assert.ok(after.widgetsEnabled.includes('workspaces'))
    assert.deepEqual(after.widgetsEnabled.filter((id) => ['shortcuts', 'todo', 'clock'].includes(id)), ['shortcuts', 'todo', 'clock'])
    assert.equal(after.settingsVersion, SETTINGS_VERSION)
    // The new card lands next to Most visited, matching a fresh install's layout.
    assert.deepEqual(after.cardOrder, ['shortcuts', 'todo', 'mostVisited', 'notes'])
    assert.deepEqual(before.widgetsEnabled, ['shortcuts', 'todo', 'clock'], 'input is not mutated')
})

test('an explicit notesEnabled opt-out survives the move into widgetsEnabled', () => {
    const after = migrateSettings({ widgetsEnabled: ['shortcuts'], notesEnabled: false })
    assert.ok(!after.widgetsEnabled.includes('notes'))
    assert.ok(after.widgetsEnabled.includes('workspaces'))
    assert.ok(!('notesEnabled' in after), 'the dropped field is not carried forward')
    // Someone who left notes on is treated the same as someone who never touched the switch.
    assert.ok(migrateSettings({ widgetsEnabled: ['shortcuts'], notesEnabled: true }).widgetsEnabled.includes('notes'))
})

test('migrating is idempotent and leaves current settings untouched', () => {
    const once = migrateSettings(DEFAULT_SETTINGS)
    assert.deepEqual(once, DEFAULT_SETTINGS)
    assert.deepEqual(migrateSettings(once), once)
    // A later version must not re-add widgets the user has since switched off.
    const trimmed = { ...DEFAULT_SETTINGS, widgetsEnabled: ['shortcuts'] }
    assert.deepEqual(migrateSettings(trimmed).widgetsEnabled, ['shortcuts'])
})

test('unusable widget and card lists fall back to the defaults instead of propagating', () => {
    const after = migrateSettings({ widgetsEnabled: null, cardOrder: null })
    assert.deepEqual(after.widgetsEnabled, DEFAULT_SETTINGS.widgetsEnabled)
    assert.deepEqual(after.cardOrder, DEFAULT_SETTINGS.cardOrder)
})

test('v1 single featured card becomes a pair without losing the choice', () => {
    const after = migrateSettings({ settingsVersion: 1, featuredCard: 'screentime', widgetsEnabled: [...DEFAULT_SETTINGS.widgetsEnabled] })
    assert.equal(after.featuredCards[0], 'screentime', 'the old choice leads the pair')
    assert.equal(after.featuredCards.length, 2, 'the second slot is filled rather than left half-set')
    assert.ok(!('featuredCard' in after), 'the dropped field does not ride along in exports')
    assert.equal(after.settingsVersion, SETTINGS_VERSION)
})

test('an unrecognised old featured card falls back to the defaults', () => {
    assert.deepEqual(migrateSettings({ settingsVersion: 1, featuredCard: 'nonsense' }).featuredCards, DEFAULT_SETTINGS.featuredCards)
    assert.deepEqual(migrateSettings({ settingsVersion: 1 }).featuredCards, DEFAULT_SETTINGS.featuredCards)
})

test('a v2 pair already chosen is left alone and capped at two', () => {
    const chosen = { settingsVersion: 3, featuredCards: ['screentime', 'shortcuts'] }
    assert.deepEqual(migrateSettings(chosen).featuredCards, ['screentime', 'shortcuts'])
    assert.equal(migrateSettings({ settingsVersion: 3, featuredCards: ['todo', 'notes', 'shortcuts'] }).featuredCards.length, 2)
})

test('a pre-v1 install picks up both version bumps in one pass', () => {
    const ancient = { widgetsEnabled: ['shortcuts', 'todo'], cardOrder: ['shortcuts', 'todo', 'mostVisited'], featuredCard: 'todo' }
    const after = migrateSettings(ancient)
    assert.ok(after.widgetsEnabled.includes('notes'))
    assert.ok(after.widgetsEnabled.includes('workspaces'))
    assert.equal(after.cardOrder.includes('notes'), true)
    assert.equal(after.featuredCards[0], 'todo')
    assert.equal(after.settingsVersion, SETTINGS_VERSION)
})

test('the retired weather card leaves the grid but keeps its feature toggle', () => {
    const before = {
        settingsVersion: 2,
        widgetsEnabled: ['todo', 'notes', 'weather', 'shortcuts'],
        cardOrder: ['todo', 'notes', 'weather', 'screentime', 'shortcuts', 'mostVisited'],
        featuredCards: ['weather', 'todo'],
    }
    const after = migrateSettings(before)
    assert.ok(!after.cardOrder.includes('weather'), 'no grid cell is reserved for a card that no longer draws one')
    assert.ok(after.widgetsEnabled.includes('weather'), 'the temperature can still be switched on; it just renders elsewhere')
    assert.ok(!after.featuredCards.includes('weather'), 'a retired card cannot hold a featured slot')
    assert.ok(after.featuredCards.length >= 1 && after.featuredCards.length <= 2)
    assert.deepEqual(before.cardOrder.includes('weather'), true, 'input is not mutated')
})

test('someone who had weather switched off keeps it off through the move', () => {
    const after = migrateSettings({ settingsVersion: 2, widgetsEnabled: ['todo', 'notes'], cardOrder: ['todo', 'notes', 'weather'] })
    assert.ok(!after.widgetsEnabled.includes('weather'))
    assert.ok(!after.cardOrder.includes('weather'))
})
