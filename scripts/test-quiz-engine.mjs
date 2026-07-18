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

function makeQuestion(bucket, index) {
  const profiles = {
    easy: {
      question: `Question simple ${index} ?`,
      answer: 'Oui'
    },
    medium: {
      question: `Quelle institution française exerce cette mission publique numéro ${index} ?`,
      answer: 'Une institution nationale chargée de cette mission'
    },
    hard: {
      question: `En quelle année la juridiction administrative a-t-elle adopté cette règle constitutionnelle numéro ${index} ?`,
      answer: 'Une décision juridictionnelle relative à la constitutionnalité administrative en 1958'
    }
  };
  const profile = profiles[bucket];
  return {
    bucket,
    id: `${bucket}-${index}`,
    theme: 'Test',
    questions: [profile.question, profile.question, profile.question],
    correctAnswers: [profile.answer],
    wrongAnswers: [
      'Une première proposition de longueur comparable',
      'Une deuxième proposition de longueur comparable',
      'Une troisième proposition de longueur comparable',
      'Une quatrième proposition de longueur comparable',
      'Une cinquième proposition de longueur comparable'
    ]
  };
}

const pool = [
  ...Array.from({ length: 30 }, (_, index) => makeQuestion('easy', index)),
  ...Array.from({ length: 30 }, (_, index) => makeQuestion('medium', index)),
  ...Array.from({ length: 30 }, (_, index) => makeQuestion('hard', index))
];

const expectedMixes = {
  csp: { easy: 24, medium: 14, hard: 2 },
  cr: { easy: 12, medium: 20, hard: 8 },
  nat: { easy: 6, medium: 16, hard: 18 }
};

for (const [level, expected] of Object.entries(expectedMixes)) {
  const engine = new context.QuizEngine({ level });
  const selected = engine.selectQuestionsByDifficulty(pool, 40);
  const actual = selected.reduce((counts, question) => {
    counts[question.bucket] += 1;
    return counts;
  }, { easy: 0, medium: 0, hard: 0 });
  assert.deepEqual(actual, expected, `${level} doit respecter son profil de difficulté`);
}

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

console.log('Moteur validé : distracteurs équilibrés et difficulté adaptée à chaque parcours.');
