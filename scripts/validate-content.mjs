import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const levels = ['csp', 'cr', 'nat'];
const expectedFiles = [
  'principes-valeurs.json',
  'institutions.json',
  'droits-devoirs.json',
  'histoire.json',
  'vie-societe.json'
];
const errors = [];
const ids = new Map();

function fail(file, id, message) {
  errors.push(`${file}${id == null ? '' : ` #${id}`}: ${message}`);
}

function answerList(question) {
  return question.correctAnswers || [question.correctAnswer];
}

function startsWithYesNo(value) {
  return /^(oui|non)\b/i.test(value.trim());
}

function isOpenQuestion(value) {
  return /^(quel(?:le|s|les)?|que|qu['’]|qui|comment|où|pourquoi|quand|depuis quand|en quelle|à quelle)\b/i.test(value.trim());
}

function explicitlyRequestsDate(value) {
  return /^(depuis quand|en quelle année|à quelle date|quelle est la date|quel jour|de quelle année|de quand date)\b/i.test(value.trim());
}

function containsDate(value) {
  return /\b\d{4}\b|\b\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i.test(value);
}

for (const level of levels) {
  for (const filename of expectedFiles) {
    const relative = `data/${level}/${filename}`;
    const file = path.join(root, relative);
    let data;

    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      fail(relative, null, `JSON invalide (${error.message})`);
      continue;
    }

    if (!Array.isArray(data.questions)) {
      fail(relative, null, 'la propriété questions doit être un tableau');
      continue;
    }

    for (const question of data.questions) {
      const id = question.id;
      if (ids.has(id)) {
        fail(relative, id, `identifiant déjà utilisé dans ${ids.get(id)}`);
      } else {
        ids.set(id, relative);
      }

      if (!Array.isArray(question.questions) || question.questions.length === 0 ||
          question.questions.some((value) => typeof value !== 'string' || !value.trim())) {
        fail(relative, id, 'au moins une formulation non vide est requise');
        continue;
      }

      const correct = answerList(question);
      const wrong = question.wrongAnswers;
      if (!Array.isArray(correct) || correct.length === 0 || correct.some((value) => typeof value !== 'string' || !value.trim())) {
        fail(relative, id, 'au moins une bonne réponse non vide est requise');
        continue;
      }
      if (!Array.isArray(wrong) || wrong.length < 3 || wrong.some((value) => typeof value !== 'string' || !value.trim())) {
        fail(relative, id, 'au moins trois distracteurs non vides sont requis');
        continue;
      }

      const normalizedCorrect = new Set(correct.map((value) => value.trim().toLocaleLowerCase('fr')));
      const normalizedWrong = wrong.map((value) => value.trim().toLocaleLowerCase('fr'));
      if (new Set(normalizedWrong).size !== normalizedWrong.length) {
        fail(relative, id, 'des distracteurs sont dupliqués');
      }
      if (normalizedWrong.some((value) => normalizedCorrect.has(value))) {
        fail(relative, id, 'une bonne réponse figure aussi parmi les distracteurs');
      }

      const allAnswers = [...correct, ...wrong];
      if (allAnswers.every(startsWithYesNo) && question.questions.some(isOpenQuestion)) {
        fail(relative, id, 'une question ouverte ne peut pas proposer uniquement des réponses Oui/Non');
      }
      if (question.questions.some(explicitlyRequestsDate) && !allAnswers.some(containsDate)) {
        fail(relative, id, 'la formulation demande une date mais aucune réponse n’en contient');
      }
      if (level === 'nat' && correct.some((value) => /\bniveau B1\b/i.test(value))) {
        fail(relative, id, 'la naturalisation exige le niveau B2 depuis le 1er janvier 2026');
      }
    }
  }
}

const sourcesPath = path.join(root, 'data/content-sources.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const expectedLanguageLevels = { csp: 'A2', cr: 'B1', nat: 'B2' };
for (const [level, expected] of Object.entries(expectedLanguageLevels)) {
  if (sources.levels?.[level]?.frenchLevel !== expected) {
    fail('data/content-sources.json', null, `${level} doit référencer le niveau ${expected}`);
  }
  if (!sources.levels?.[level]?.officialQuestions?.startsWith('https://')) {
    fail('data/content-sources.json', null, `${level} doit référencer sa liste officielle`);
  }
}

if (errors.length > 0) {
  console.error(`Validation du contenu échouée (${errors.length} erreur${errors.length > 1 ? 's' : ''}) :`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Contenu validé : ${ids.size} questions, 3 niveaux, 5 thèmes, sources officielles référencées.`);
