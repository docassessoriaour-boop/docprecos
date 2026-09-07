import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const SEARCH_STOP_WORDS'), app.indexOf('const getReportShift'));
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
const [value, compare, physicalPackage] = vm.runInNewContext(`${code}\n[getProductPackageValue, compareProductsByPackageValue, getProductPackageInfo]`);
const product = (name, price, unit = 'un') => ({ name, price, unit, market: 'Mercado' });
for (const [name, price, expected, basis] of [
  ['Creme Dental Colgate Total 12 C/3 90g', 23.97, 7.99, 'count'],
  ['Creme Dental Colgate Total 12 90g', 7.99, 7.99, 'count'],
  ['Pasta de dentes 3x90g', 23.97, 7.99, 'count'],
  ['Sabonete Dove C/6 Unidades 90g', 23.94, 3.99, 'count'],
  ['Sabonete em Barra Protex Pack com 8x85g', 19.90, 19.90 / 8, 'count'],
  ['Sabonete Protex 8 × 85g leve 8 pague 6', 19.90, 19.90 / 8, 'count'],
  ['Sabonete Protex 85g pack com 8 unidades', 19.90, 19.90 / 8, 'count'],
  ['Sabonete Protex 85g', 2.99, 2.99, 'count'],
  ['Sabão em barra 5x200g', 10, 2, 'count'],
  ['Fraldas 30 unidades', 30, 1, 'count'],
  ['Ovos 12 unidades', 12, 1, 'count'],
  ['Papel higiênico 12 rolos 30m', 12, 1, 'count'],
  ['Sabonete líquido 250ml', 10, 40, 'volume'],
  ['Arroz 5kg', 20, 4, 'weight'],
  ['Acém kg', 30, 30, 'weight'],
  ['Músculo Bovino KG', 32.98, 32.98, 'weight'],
  ['Leite 6x1L', 24, 4, 'volume'],
]) test(`${name} uses ${basis}`, () => {
  const result = value(product(name, price));
  assert.equal(result.packageInfo.kind, basis);
  assert.ok(Math.abs(result.valuePrice - expected) < 1e-9);
});
test('Flyer pack displays R$ 2,49/un and keeps the purchase price', () => {
  const pack = product('Sabonete Protex com 8x85g', 19.90);
  assert.equal(value(pack).label, 'R$ 2,49/un');
  assert.equal(pack.price * 2, 39.80);
  assert.ok(compare(pack, product('Sabonete Protex 85g', 2.99)) < 0);
});
test('Physical weight is preserved independently of per-unit comparison', () => {
  assert.equal(physicalPackage('Sabonete Protex 8x85g').normalizedAmount, 680);
});
