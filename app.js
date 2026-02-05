// État de l'application
const state = {
    selectedLevel: null,
    questions: [],
    preparedQuestions: [], // Questions préparées avec formulation et options aléatoires
    currentQuestionIndex: 0,
    userAnswers: [],
    timerInterval: null,
    timeRemaining: 45 * 60, // 45 minutes en secondes
    quizStarted: false
};

// Éléments du DOM
const homeScreen = document.getElementById('home-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const levelBtns = document.querySelectorAll('.level-btn');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');
const questionCounter = document.getElementById('question-counter');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress');
const themeBadge = document.getElementById('theme-badge');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // Sélection du niveau
    levelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            levelBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.selectedLevel = btn.dataset.level;
            startBtn.disabled = false;
        });
    });

    // Démarrer le quiz
    startBtn.addEventListener('click', startQuiz);

    // Question suivante
    nextBtn.addEventListener('click', nextQuestion);

    // Recommencer
    restartBtn.addEventListener('click', resetQuiz);
}

async function startQuiz() {
    try {
        // Charger les questions
        const response = await fetch(`data/questions-${state.selectedLevel}.json`);
        const data = await response.json();

        // Sélectionner 40 questions au hasard (par ID unique)
        state.questions = shuffleArray(data.questions).slice(0, 40);

        // Préparer chaque question avec formulation et options aléatoires
        state.preparedQuestions = state.questions.map(q => prepareQuestion(q));

        state.currentQuestionIndex = 0;
        state.userAnswers = new Array(40).fill(null);
        state.timeRemaining = 45 * 60;
        state.quizStarted = true;

        // Afficher l'écran du quiz
        showScreen(quizScreen);

        // Démarrer le timer
        startTimer();

        // Afficher la première question
        displayQuestion();
    } catch (error) {
        console.error('Erreur lors du chargement des questions:', error);
        alert('Erreur lors du chargement des questions. Veuillez réessayer.');
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Prépare une question avec formulation aléatoire et options mélangées
function prepareQuestion(questionData) {
    // Choisir une formulation aléatoire de la question
    const questionVariants = questionData.questions;
    const selectedQuestion = questionVariants[Math.floor(Math.random() * questionVariants.length)];

    // Sélectionner 3 mauvaises réponses au hasard parmi toutes les disponibles
    const shuffledWrongAnswers = shuffleArray(questionData.wrongAnswers).slice(0, 3);

    // Créer le tableau des 4 options (1 correcte + 3 fausses)
    const allOptions = [questionData.correctAnswer, ...shuffledWrongAnswers];

    // Mélanger les options et trouver la position de la bonne réponse
    const shuffledOptions = shuffleArray(allOptions);
    const correctAnswerIndex = shuffledOptions.indexOf(questionData.correctAnswer);

    return {
        id: questionData.id,
        theme: questionData.theme,
        question: selectedQuestion,
        options: shuffledOptions,
        correctAnswer: correctAnswerIndex,
        correctAnswerText: questionData.correctAnswer
    };
}

function startTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();

        if (state.timeRemaining <= 0) {
            clearInterval(state.timerInterval);
            endQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = state.timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Avertissement quand moins de 5 minutes
    if (state.timeRemaining <= 300) {
        timerDisplay.classList.add('warning');
    } else {
        timerDisplay.classList.remove('warning');
    }
}

function displayQuestion() {
    const question = state.preparedQuestions[state.currentQuestionIndex];

    // Mettre à jour le compteur et la barre de progression
    questionCounter.textContent = `Question ${state.currentQuestionIndex + 1}/40`;
    progressBar.style.width = `${((state.currentQuestionIndex + 1) / 40) * 100}%`;

    // Afficher le thème
    themeBadge.textContent = question.theme;

    // Afficher la question
    questionText.textContent = question.question;

    // Générer les options
    const letters = ['A', 'B', 'C', 'D'];
    optionsContainer.innerHTML = question.options.map((option, index) => `
        <button class="option-btn" data-index="${index}">
            <span class="option-letter">${letters[index]}</span>
            <span class="option-text">${option}</span>
        </button>
    `).join('');

    // Ajouter les événements aux options
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption(btn));
    });

    // Désactiver le bouton suivant
    nextBtn.disabled = true;

    // Si c'est la dernière question, changer le texte du bouton
    if (state.currentQuestionIndex === 39) {
        nextBtn.textContent = 'Voir les résultats';
    } else {
        nextBtn.textContent = 'Question suivante';
    }
}

function selectOption(selectedBtn) {
    const question = state.preparedQuestions[state.currentQuestionIndex];
    const selectedIndex = parseInt(selectedBtn.dataset.index);
    const correctIndex = question.correctAnswer;

    // Enregistrer la réponse
    state.userAnswers[state.currentQuestionIndex] = selectedIndex;

    // Désactiver tous les boutons
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        const btnIndex = parseInt(btn.dataset.index);

        if (btnIndex === correctIndex) {
            btn.classList.add('correct');
        } else if (btnIndex === selectedIndex && selectedIndex !== correctIndex) {
            btn.classList.add('incorrect');
        }
    });

    // Activer le bouton suivant
    nextBtn.disabled = false;
}

function nextQuestion() {
    if (state.currentQuestionIndex < 39) {
        state.currentQuestionIndex++;
        displayQuestion();
    } else {
        endQuiz();
    }
}

function endQuiz() {
    clearInterval(state.timerInterval);
    state.quizStarted = false;

    // Calculer le score
    let score = 0;
    state.preparedQuestions.forEach((question, index) => {
        if (state.userAnswers[index] === question.correctAnswer) {
            score++;
        }
    });

    // Afficher les résultats
    displayResults(score);
}

function displayResults(score) {
    showScreen(resultsScreen);

    const passed = score >= 32;
    const percentage = Math.round((score / 40) * 100);

    // Header
    const resultHeader = document.getElementById('result-header');
    const resultTitle = document.getElementById('result-title');
    resultHeader.className = `result-header ${passed ? 'success' : 'failure'}`;
    resultTitle.textContent = passed ? 'Félicitations !' : 'Dommage...';

    // Score
    const scoreCircle = document.getElementById('score-circle');
    const scoreNumber = document.getElementById('score-number');
    const scorePercentage = document.getElementById('score-percentage');
    const resultMessage = document.getElementById('result-message');

    scoreCircle.className = `score-circle ${passed ? 'success' : 'failure'}`;
    scoreNumber.textContent = score;
    scorePercentage.textContent = `${percentage}%`;

    resultMessage.className = `result-message ${passed ? 'success' : 'failure'}`;
    resultMessage.textContent = passed
        ? 'Vous avez réussi l\'examen !'
        : `Il vous manque ${32 - score} bonne(s) réponse(s) pour réussir.`;

    // Liste des réponses
    const answersList = document.getElementById('answers-list');
    answersList.innerHTML = state.preparedQuestions.map((question, index) => {
        const userAnswer = state.userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswer;
        const letters = ['A', 'B', 'C', 'D'];

        return `
            <div class="answer-item ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="answer-question">
                    ${index + 1}. ${question.question}
                </div>
                <div class="answer-detail">
                    ${isCorrect
                        ? `<span class="correct-answer">✓ ${letters[question.correctAnswer]}. ${question.options[question.correctAnswer]}</span>`
                        : `<span class="your-answer">✗ Votre réponse : ${userAnswer !== null ? letters[userAnswer] + '. ' + question.options[userAnswer] : 'Pas de réponse'}</span><br>
                           <span class="correct-answer">✓ Bonne réponse : ${letters[question.correctAnswer]}. ${question.options[question.correctAnswer]}</span>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function resetQuiz() {
    state.selectedLevel = null;
    state.questions = [];
    state.preparedQuestions = [];
    state.currentQuestionIndex = 0;
    state.userAnswers = [];
    state.timeRemaining = 45 * 60;

    // Réinitialiser l'interface
    levelBtns.forEach(b => b.classList.remove('selected'));
    startBtn.disabled = true;
    timerDisplay.classList.remove('warning');

    showScreen(homeScreen);
}

function showScreen(screen) {
    [homeScreen, quizScreen, resultsScreen].forEach(s => {
        s.classList.remove('active');
    });
    screen.classList.add('active');
    window.scrollTo(0, 0);
}
