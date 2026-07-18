import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({
  console,
  Set,
  document: {},
  window: {},
  getBasePath: () => '/'
});

const configSource = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8')
  .replace('const SiteConfig =', 'var SiteConfig =');
vm.runInContext(configSource, context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/quiz-engine.js'), 'utf8'), context);

const balanceEngine = new context.QuizEngine({ level: 'csp' });
const correct = 'Une réponse correcte avec neuf mots bien équilibrés ici';
const distractors = [
  'Court',
  'Beaucoup trop bref',
  'Une proposition incorrecte avec huit mots bien équilibrés ici',
  'Une autre proposition incorrecte de neuf mots bien équilibrés',
  'Une proposition alternative contenant dix mots et un détail crédible',
  'Une proposition volontairement beaucoup trop longue qui contient de nombreux détails inutiles et déséquilibre complètement les choix'
];

for (let attempt = 0; attempt < 50; attempt += 1) {
  const selected = balanceEngine.selectBalancedWrongAnswers(correct, distractors, 3);
  assert.equal(selected.length, 3);
  assert(!selected.includes('Court'), 'le distracteur manifestement trop court doit être exclu');
}

const prepared = balanceEngine.prepareQuestion({
  id: 1,
  theme: 'Test',
  questions: ['Question officielle ?', 'Autre formulation ?', 'Troisième formulation ?'],
  correctAnswers: [correct],
  wrongAnswers: distractors
});
assert.equal(prepared.options.length, 4, 'le format officiel comporte exactement quatre choix');
assert.equal(
  prepared.options.filter((option) => option === correct).length,
  1,
  'une seule bonne réponse doit être affichée'
);

assert.equal(context.SiteConfig.exam.questionCount, 40);
assert.equal(context.SiteConfig.exam.timeMinutes, 45);
assert.equal(context.SiteConfig.exam.passScore, 32);

console.log('Moteur validé : quatre choix, une bonne réponse et distracteurs équilibrés.');
