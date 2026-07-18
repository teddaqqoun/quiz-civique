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
const maxBalancedLengthRatio = { csp: 3, cr: 3, nat: 3.5 };
const officialStems = new Map(Object.entries({
  'data/csp/droits-devoirs.json#59': 'Quel est le rôle principal de la police ?',
  'data/csp/droits-devoirs.json#64': 'Quel droit permet à une personne de se défendre devant la justice ?',
  'data/csp/histoire.json#193': 'Quel écrivain est français ?',
  'data/csp/vie-societe.json#110': 'Après avoir obtenu le permis de conduire, que faut-il faire pour pouvoir conduire sa voiture ?',
  'data/csp/vie-societe.json#111': "Quand faut-il déclarer son enfant au service d'état civil de la mairie ?",
  'data/csp/vie-societe.json#125': "Quel est l'objectif des vaccinations obligatoires ?",
  'data/csp/vie-societe.json#189': 'Une femme peut-elle créer son entreprise ?',
  'data/csp/vie-societe.json#191': 'À quoi sert la carte Vitale ?',
  'data/cr/institutions.json#340': 'Le président de la République a commis un crime. Quelle proposition est correcte ?',
  'data/cr/histoire.json#267': 'Où a eu lieu le débarquement en 1944 ?',
  'data/cr/vie-societe.json#394': "Quelle est l'une des conditions pour passer l'examen du permis de conduire ?",
  'data/nat/institutions.json#595': 'Où est le siège de la Banque centrale européenne ?',
  'data/nat/vie-societe.json#741': "Quel motif d'absence est accepté par l'école ?",
  'data/nat/vie-societe.json#767': 'Le stationnement sur une place réservée aux personnes handicapées :',
  'data/nat/vie-societe.json#768': 'Qui a le droit de se syndiquer ?'
}));

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

      if (!Array.isArray(question.questions) || question.questions.length < 3 ||
          question.questions.some((value) => typeof value !== 'string' || !value.trim())) {
        fail(relative, id, 'au moins trois formulations non vides sont requises');
        continue;
      }

      const officialStem = officialStems.get(`${relative}#${id}`);
      if (officialStem && question.questions[0] !== officialStem) {
        fail(relative, id, 'la première formulation doit rester identique à la liste officielle');
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

      const correctLength = correct[0].trim().split(/\s+/).length;
      const closestDistractorLengths = wrong
        .map((value) => value.trim().split(/\s+/).length)
        .sort((a, b) => Math.abs(a - correctLength) - Math.abs(b - correctLength))
        .slice(0, 3);
      const worstBalancedRatio = Math.max(...closestDistractorLengths.map((length) =>
        Math.max(correctLength, length) / Math.max(1, Math.min(correctLength, length))
      ));
      if (worstBalancedRatio > maxBalancedLengthRatio[level]) {
        fail(relative, id, `aucun groupe de trois distracteurs n’a une longueur crédible (ratio ${worstBalancedRatio.toFixed(1)})`);
      }

      if (level === 'csp' && question.questions.some((value) => /système métrique/i.test(value))) {
        fail(relative, id, 'ce sujet ne figure pas dans la liste officielle CSP');
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

const expectedOfficialFormat = {
  questionCount: 40,
  knowledgeQuestions: 28,
  scenarioQuestions: 12,
  optionsPerQuestion: 4,
  correctOptionsPerQuestion: 1,
  durationMinutes: 45,
  passScore: 32
};
for (const [key, expected] of Object.entries(expectedOfficialFormat)) {
  if (sources.officialFormat?.[key] !== expected) {
    fail('data/content-sources.json', null, `le format officiel exige ${key}=${expected}`);
  }
}

if (errors.length > 0) {
  console.error(`Validation du contenu échouée (${errors.length} erreur${errors.length > 1 ? 's' : ''}) :`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Contenu validé : ${ids.size} questions, 3 niveaux, 5 thèmes, sources officielles référencées.`);
