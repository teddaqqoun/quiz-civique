// QuizEngine — reusable quiz/simulation logic
// Usage: new QuizEngine({ level, themes, questionCount, timed, timeMinutes, containerId, mode, showFeedback })

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function QuizEngine(options) {
    this.level = options.level;
    this.themes = options.themes || null; // array of theme slugs, null = all
    this.questionCount = options.questionCount || null; // null = all available
    this.timed = options.timed !== false;
    this.timeMinutes = options.timeMinutes || 45;
    this.containerId = options.containerId || 'quiz-container';
    this.mode = options.mode || 'quiz'; // 'quiz' or 'simulation'
    this.showFeedback = options.showFeedback !== false; // false for simulation
    this.dataPath = options.dataPath || (getBasePath() + 'data/');
    this.autoStart = options.autoStart || false;

    this.questions = [];
    this.preparedQuestions = [];
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.timerInterval = null;
    this.timeRemaining = this.timeMinutes * 60;
    this.quizStarted = false;
    this.container = null;
}

QuizEngine.prototype.init = function () {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;
    if (this.autoStart) {
        this.startQuiz();
    } else {
        this.renderStartScreen();
    }
};

QuizEngine.prototype.renderStartScreen = function () {
    var self = this;
    var levelInfo = SiteConfig.levels[this.level];
    var themesLabel = this.themes
        ? this.themes.map(function (t) { return SiteConfig.themeLabels[t] || t; }).join(', ')
        : 'Tous les thèmes';
    var qCount = this.questionCount || levelInfo.questionCount;
    var isSimulation = this.mode === 'simulation';

    this.container.innerHTML =
        '<div class="container">' +
            '<div class="rules-box">' +
                '<h2>' + (isSimulation ? 'Simulation d\'examen' : 'Quiz') + ' — ' + levelInfo.label + '</h2>' +
                '<p style="margin-bottom:12px;color:#666;">Thèmes : ' + themesLabel + '</p>' +
                '<ul>' +
                    '<li><strong>' + (this.questionCount || SiteConfig.exam.questionCount) + ' questions</strong> à choix multiples</li>' +
                    (this.timed ? '<li><strong>' + this.timeMinutes + ' minutes</strong> maximum</li>' : '') +
                    (isSimulation ? '<li><strong>' + SiteConfig.exam.passScore + '/' + SiteConfig.exam.questionCount + '</strong> (80%) pour réussir</li>' : '') +
                    '<li>4 options par question, 1 seule bonne réponse</li>' +
                    (isSimulation ? '<li>Résultats affichés uniquement à la fin</li>' : '') +
                '</ul>' +
            '</div>' +
            '<button class="primary-btn" id="qe-start-btn">' +
                (isSimulation ? 'Commencer la simulation' : 'Commencer le quiz') +
            '</button>' +
        '</div>';

    document.getElementById('qe-start-btn').addEventListener('click', function () {
        self.startQuiz();
    });
};

QuizEngine.prototype.startQuiz = function () {
    var self = this;
    var allThemes = SiteConfig.themes.map(function (t) { return t.slug; });
    var themesToLoad = this.themes || allThemes;

    var fetches = themesToLoad.map(function (theme) {
        return fetch(self.dataPath + self.level + '/' + theme + '.json').then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    });

    Promise.all(fetches).then(function (dataArrays) {
        var allQuestions = [];
        dataArrays.forEach(function (data) {
            if (data.questions) allQuestions = allQuestions.concat(data.questions);
        });

        var shuffled = self.shuffleArray(allQuestions);
        var count = self.questionCount || SiteConfig.exam.questionCount;
        if (count > shuffled.length) count = shuffled.length;
        self.questions = shuffled.slice(0, count);
        self.preparedQuestions = self.questions.map(function (q) { return self.prepareQuestion(q); });
        self.currentQuestionIndex = 0;
        self.userAnswers = new Array(self.preparedQuestions.length).fill(null);
        self.timeRemaining = self.timeMinutes * 60;
        self.quizStarted = true;

        self.renderQuizScreen();
        if (self.timed) self.startTimer();
        self.displayQuestion();
    }).catch(function (err) {
        console.error('Erreur chargement questions:', err);
        self.container.innerHTML = '<div class="container"><p style="color:red;text-align:center;">Erreur lors du chargement des questions. Veuillez réessayer.</p></div>';
    });
};

QuizEngine.prototype.renderQuizScreen = function () {
    var total = this.preparedQuestions.length;
    this.container.innerHTML =
        '<div class="quiz-header">' +
            '<div class="progress-info">' +
                '<span id="qe-counter">Question 1/' + total + '</span>' +
                (this.timed ? '<span id="qe-timer" class="timer">' + this.formatTime(this.timeRemaining) + '</span>' : '') +
            '</div>' +
            '<div class="progress-bar"><div id="qe-progress" class="progress-fill"></div></div>' +
        '</div>' +
        '<div class="quiz-content">' +
            '<div class="theme-badge" id="qe-theme">Thème</div>' +
            '<h2 id="qe-question" class="question-text"></h2>' +
            '<div id="qe-options" class="options-container"></div>' +
        '</div>' +
        '<div class="quiz-footer">' +
            '<button id="qe-next" class="primary-btn" disabled>Question suivante</button>' +
        '</div>';

    var self = this;
    document.getElementById('qe-next').addEventListener('click', function () {
        self.nextQuestion();
    });
};

QuizEngine.prototype.displayQuestion = function () {
    var q = this.preparedQuestions[this.currentQuestionIndex];
    var total = this.preparedQuestions.length;
    var counter = document.getElementById('qe-counter');
    var progress = document.getElementById('qe-progress');
    var theme = document.getElementById('qe-theme');
    var question = document.getElementById('qe-question');
    var options = document.getElementById('qe-options');
    var nextBtn = document.getElementById('qe-next');

    counter.textContent = 'Question ' + (this.currentQuestionIndex + 1) + '/' + total;
    progress.style.width = (this.currentQuestionIndex / total * 100) + '%';
    theme.textContent = q.theme;
    question.textContent = q.question;

    var letters = ['A', 'B', 'C', 'D'];
    options.innerHTML = q.options.map(function (opt, i) {
        return '<button class="option-btn" data-index="' + i + '">' +
            '<span class="option-letter">' + letters[i] + '</span>' +
            '<span class="option-text">' + escapeHtml(opt) + '</span>' +
        '</button>';
    }).join('');

    var self = this;
    options.querySelectorAll('.option-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { self.selectOption(btn); });
    });

    nextBtn.disabled = true;
    if (this.currentQuestionIndex === total - 1) {
        nextBtn.textContent = 'Voir les résultats';
    } else {
        nextBtn.textContent = 'Question suivante';
    }
};

QuizEngine.prototype.selectOption = function (selectedBtn) {
    var q = this.preparedQuestions[this.currentQuestionIndex];
    var selectedIndex = parseInt(selectedBtn.dataset.index);
    var correctIndex = q.correctAnswer;
    this.userAnswers[this.currentQuestionIndex] = selectedIndex;

    var buttons = document.querySelectorAll('#qe-options .option-btn');
    buttons.forEach(function (btn) {
        btn.disabled = true;
    });

    if (this.showFeedback) {
        buttons.forEach(function (btn) {
            var idx = parseInt(btn.dataset.index);
            if (idx === correctIndex) btn.classList.add('correct');
            else if (idx === selectedIndex && selectedIndex !== correctIndex) btn.classList.add('incorrect');
        });
    } else {
        selectedBtn.classList.add('selected');
    }

    document.getElementById('qe-next').disabled = false;
};

QuizEngine.prototype.nextQuestion = function () {
    if (this.currentQuestionIndex < this.preparedQuestions.length - 1) {
        this.currentQuestionIndex++;
        this.displayQuestion();
    } else {
        var progress = document.getElementById('qe-progress');
        if (progress) progress.style.width = '100%';
        var self = this;
        setTimeout(function () { self.endQuiz(); }, 400);
    }
};

QuizEngine.prototype.endQuiz = function () {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.quizStarted = false;

    var score = 0;
    var self = this;
    this.preparedQuestions.forEach(function (q, i) {
        if (self.userAnswers[i] === q.correctAnswer) score++;
    });
    this.displayResults(score);
};

QuizEngine.prototype.displayResults = function (score) {
    var total = this.preparedQuestions.length;
    var passScore = this.mode === 'simulation' ? SiteConfig.exam.passScore : Math.ceil(total * SiteConfig.exam.passThreshold);
    var passed = score >= passScore;
    var percentage = Math.round((score / total) * 100);

    var totalTime = this.timeMinutes * 60;
    var timeTaken = totalTime - this.timeRemaining;
    var min = Math.floor(timeTaken / 60);
    var sec = timeTaken % 60;

    var letters = ['A', 'B', 'C', 'D'];
    var self = this;

    var answersHtml = this.preparedQuestions.map(function (q, i) {
        var userAns = self.userAnswers[i];
        var isCorrect = userAns === q.correctAnswer;
        return '<div class="answer-item ' + (isCorrect ? 'correct' : 'incorrect') + '">' +
            '<div class="answer-question">' + (i + 1) + '. ' + escapeHtml(q.question) + '</div>' +
            '<div class="answer-detail">' +
                (isCorrect
                    ? '<span class="correct-answer">' + letters[q.correctAnswer] + '. ' + escapeHtml(q.options[q.correctAnswer]) + '</span>'
                    : '<span class="your-answer">Votre réponse : ' + (userAns !== null ? letters[userAns] + '. ' + escapeHtml(q.options[userAns]) : 'Pas de réponse') + '</span><br>' +
                      '<span class="correct-answer">Bonne réponse : ' + letters[q.correctAnswer] + '. ' + escapeHtml(q.options[q.correctAnswer]) + '</span>'
                ) +
            '</div>' +
        '</div>';
    }).join('');

    this.container.innerHTML =
        '<div class="container">' +
            '<div class="result-header ' + (passed ? 'success' : 'failure') + '">' +
                '<div class="result-icon"></div>' +
                '<h1>' + (passed ? 'Félicitations !' : 'Dommage...') + '</h1>' +
            '</div>' +
            '<div class="score-display">' +
                '<div class="score-circle ' + (passed ? 'success' : 'failure') + '">' +
                    '<span id="score-number">' + score + '</span>' +
                    '<span class="score-total">/' + total + '</span>' +
                '</div>' +
                '<p class="score-percentage">' + percentage + '%</p>' +
                (this.timed ? '<p class="time-taken">Temps : ' + min + 'min ' + String(sec).padStart(2, '0') + 's</p>' : '') +
                '<p class="result-message ' + (passed ? 'success' : 'failure') + '">' +
                    (passed ? 'Vous avez réussi !' : 'Il vous manque ' + (passScore - score) + ' bonne(s) réponse(s) pour réussir.') +
                '</p>' +
            '</div>' +
            '<div class="results-details">' +
                '<h2>Détail des réponses</h2>' +
                '<div class="answers-list">' + answersHtml + '</div>' +
            '</div>' +
            '<button class="primary-btn" id="qe-restart">Recommencer</button>' +
        '</div>';

    var self = this;
    document.getElementById('qe-restart').addEventListener('click', function () {
        self.renderStartScreen();
    });
};

QuizEngine.prototype.startTimer = function () {
    var self = this;
    this.updateTimerDisplay();
    this.timerInterval = setInterval(function () {
        self.timeRemaining--;
        self.updateTimerDisplay();
        if (self.timeRemaining <= 0) {
            clearInterval(self.timerInterval);
            self.endQuiz();
        }
    }, 1000);
};

QuizEngine.prototype.updateTimerDisplay = function () {
    var el = document.getElementById('qe-timer');
    if (!el) return;
    el.textContent = this.formatTime(this.timeRemaining);
    if (this.timeRemaining <= 300) {
        el.classList.add('warning');
    } else {
        el.classList.remove('warning');
    }
};

QuizEngine.prototype.formatTime = function (seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

QuizEngine.prototype.shuffleArray = function (array) {
    var shuffled = array.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }
    return shuffled;
};

QuizEngine.prototype.prepareQuestion = function (questionData) {
    var questionVariants = questionData.questions;
    var selectedQuestion = questionVariants[Math.floor(Math.random() * questionVariants.length)];
    var correctAnswersArray = questionData.correctAnswers || [questionData.correctAnswer];
    var selectedCorrectAnswer = correctAnswersArray[Math.floor(Math.random() * correctAnswersArray.length)];
    var shuffledWrongAnswers = this.shuffleArray(questionData.wrongAnswers).slice(0, 3);
    var allOptions = [selectedCorrectAnswer].concat(shuffledWrongAnswers);
    var shuffledOptions = this.shuffleArray(allOptions);
    var correctAnswerIndex = shuffledOptions.indexOf(selectedCorrectAnswer);

    return {
        id: questionData.id,
        theme: questionData.theme,
        question: selectedQuestion,
        options: shuffledOptions,
        correctAnswer: correctAnswerIndex,
        correctAnswerText: selectedCorrectAnswer,
        allCorrectAnswers: correctAnswersArray
    };
};
