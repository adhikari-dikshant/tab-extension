import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowOverlay } from '../src/lib/overlay.ts'

test('the overlay stays off sign-in and payment pages whatever the settings say', () => {
    for (const host of ['accounts.google.com', 'login.microsoftonline.com', 'checkout.stripe.com', 'paypal.com', 'www.paypal.com']) {
        assert.equal(shouldShowOverlay(host, []), false, `${host} should never show the overlay`)
    }
})

test('ordinary sites show it unless the user hid it there', () => {
    assert.equal(shouldShowOverlay('example.com', []), true)
    assert.equal(shouldShowOverlay('example.com', ['example.com']), false)
    assert.equal(shouldShowOverlay('example.com', ['other.com']), true)
})

test('hiding a site covers its subdomains, and www is not a different site', () => {
    assert.equal(shouldShowOverlay('docs.example.com', ['example.com']), false)
    assert.equal(shouldShowOverlay('www.example.com', ['example.com']), false)
    assert.equal(shouldShowOverlay('example.com', ['www.example.com']), false)
    // A suffix match must not catch an unrelated host that merely ends the same way.
    assert.equal(shouldShowOverlay('notexample.com', ['example.com']), true)
})

test('host matching ignores case', () => {
    assert.equal(shouldShowOverlay('EXAMPLE.com', ['example.com']), false)
    assert.equal(shouldShowOverlay('example.com', ['EXAMPLE.COM']), false)
    assert.equal(shouldShowOverlay('ACCOUNTS.GOOGLE.COM', []), false)
})
