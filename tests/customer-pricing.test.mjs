import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readCustomerPrices, resolveCustomerPrice } from '../src/utils/customerPricing.mjs';
const offer = { name: 'Músculo Bovino KG', price: 39.90, regularPrice: 39.90, specialPrice: 32.98 };
test('Default and nonmembers pay the regular price', () => {
  assert.equal(resolveCustomerPrice(offer, false).price, 39.90);
});
test('Members get the club price without mutating the stored offer', () => {
  assert.equal(resolveCustomerPrice(offer, true).price, 32.98);
  assert.equal(resolveCustomerPrice(offer, true).priceTier, 'special');
  assert.equal(offer.price, 39.90);
  assert.equal(resolveCustomerPrice(offer, false).price, 39.90);
});
test('An exclusive-only offer is never available to nonmembers', () => {
  const special = { price: 32.98, specialPrice: 32.98, specialOnly: true };
  assert.equal(resolveCustomerPrice(special, false), null);
  assert.equal(resolveCustomerPrice(special, true).price, 32.98);
});
test('Legacy offers and cheaper regular prices continue to work', () => {
  assert.equal(resolveCustomerPrice({ price: 10 }, true).price, 10);
  assert.equal(resolveCustomerPrice({ price: 10, specialPrice: 12 }, true).price, 10);
});
test('Read decimal prices, conditions and reject invalid numbers', () => {
  assert.equal(readCustomerPrices({ regularPrice: '39,90', specialPrice: '32,98' }).specialPrice, 32.98);
  assert.equal(readCustomerPrices({ specialPrice: -1 }).specialPrice, undefined);
  assert.equal(readCustomerPrices({ regularPrice: 39.9, specialOnly: true }).specialOnly, false);
});
test('Different market eligibility produces different totals', () => {
  const total = [false, true].reduce((sum, eligible) => sum + resolveCustomerPrice(offer, eligible).price * 2, 0);
  assert.ok(Math.abs(total - 145.76) < 0.001);
});
