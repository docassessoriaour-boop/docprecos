import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';

// Exercise the actual scoring functions used by search, comparison and reports.
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const SEARCH_STOP_WORDS'), app.indexOf('const formatCurrency'));
const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
const scores = vm.runInNewContext(`${code}\n[getProductMatchScore, getSavedListItemOfferScore]`);
const negative = [
  ['AREIA PARA GATO', 'Alim Gato Catchoni Castrados Frango Arroz 1kg'],
  ['requeijão cremoso 400g', 'Requeijão Cremoso Scala Cheddar Bisnaga 1,5kg'],
  ['requeijão cremoso 400g', 'Requeijão Cremoso 200g'],
  ['requeijão cremoso 400g', 'Requeijão Cremoso'],
  ['ACHOCOLATADO ALPINO', 'Achocolatado em Pó Italac Pacote 1kg'],
  ['achocolatado Marca Nova', 'Achocolatado Outra Marca 400g'],
  ['ALCOOL', 'Vinagre Castelo Alcool 750ml'],
  ['CARNE BOVINA - ACÉM', 'Hambúrguer Texas Burger Carne de Frango e Bovina'],
  ['carne bovina acen', 'Carne bovina músculo kg'],
  ['Morango kg', 'Bolo Leite Ninho e Morango Kg'],
  ['Cenoura kg', 'Bolo Cenoura e Calda Chocolate Kg'],
  ['banana', 'Iogurte de banana'],
  ['leite', 'Leite condensado 395g'],
  ['café', 'Filtro para café'],
];
const positive = [
  ['areia para gato', 'Areia higiênica para gato 4kg'],
  ['requeijão cremoso 400g', 'Requeijão Cremoso Scala 400g'],
  ['requeijão cremoso 400g', 'Requeijão Cremoso Scala 0,4kg'],
  ['achocolatado alpino', 'Achocolatado Alpino Nestlé 400g'],
  ['álcool', 'Álcool líquido 70% 1L'],
  ['carne bovina acen', 'Acém bovino kg'],
  ['Morango kg', 'Morango fresco kg'],
  ['Cenoura kg', 'Cenoura kg'],
  ['vinagre de álcool', 'Vinagre Castelo de Álcool 750ml'],
  ['bolo de morango', 'Bolo de Morango kg'],
];
for (const [index, score] of scores.entries()) {
  for (const [query, name] of negative) test(`scorer ${index} rejects ${query} / ${name}`, () => {
    assert.equal(score(query, { name, unit: 'un', category: query, market: query }), 0);
  });
  for (const [query, name] of positive) test(`scorer ${index} accepts ${query} / ${name}`, () => {
    assert.ok(score(query, { name, unit: 'un', category: 'Outros', market: 'Mercado' }) >= 0.45);
  });
}
