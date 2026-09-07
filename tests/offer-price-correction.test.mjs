import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
import { normalizeMarketName } from '../src/utils/marketNames.ts';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const normalize = app.slice(app.indexOf('const normalizeDuplicateKeyText'), app.indexOf('const formatProductPriceForKey'));
const correction = app.slice(app.indexOf('const correctKnownOfferPrice'), app.indexOf('const removeExpiredProducts'));
const code = ts.transpile(`${normalize}\n${correction}`, { target: ts.ScriptTarget.ES2022 });
const correct = vm.runInNewContext(`${code}\ncorrectKnownOfferPrice`, { normalizeMarketName });
const rejected = vm.runInNewContext(`${code}\nisKnownIncorrectOffer`, { normalizeMarketName });
const offer = { name: 'Sabonete Dove C/6 Unidades 90g', market: 'Amigão', city: 'Ourinhos', endDate: '2026-09-09', price: 3.99 };
test('Repair the known unit-price extraction, exactly once', () => {
  const result = correct(offer);
  assert.equal(result.price, 23.94);
  assert.equal(correct(result).price, 23.94);
  assert.equal(offer.price, 3.99);
});
for (const change of [
  { price: 4.99 }, { market: 'Outro' }, { city: 'Outra' },
  { endDate: '2026-09-10' }, { name: 'Sabonete Dove 90g' },
]) test(`Preserve unrelated offers: ${JSON.stringify(change)}`, () => {
  const other = { ...offer, ...change };
  assert.equal(correct(other), other);
});

const muscle = { name: 'Músculo Bovino KG', market: 'Sagrada Família', city: 'Ourinhos', endDate: '2026-09-07', price: 19.99 };
test('Exclude the reported muscle offer without inventing a replacement price', () => {
  assert.equal(rejected(muscle), true);
  assert.equal(correct(muscle).price, 19.99);
});
for (const change of [{ name: 'Acém Bovino KG' }, { market: 'Outro' }, { endDate: '2026-09-08' }, { price: 32.98 }]) {
  test(`Do not exclude other meat offers: ${JSON.stringify(change)}`, () => {
    assert.equal(rejected({ ...muscle, ...change }), false);
  });
}
