// QuizEngine — reusable quiz/simulation logic
// Usage: new QuizEngine({ level, themes, questionCount, timed, timeMinutes, containerId, mode, showFeedback })

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function createFeedbackTrackingId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return prefix + ':' + window.crypto.randomUUID();
    }
    return prefix + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
}

function getFeedbackSessionId() {
    var storageKey = 'quiz_feedback_session_id';
    try {
        var existing = window.sessionStorage.getItem(storageKey);
        if (existing) return existing;
        var created = createFeedbackTrackingId('session');
        window.sessionStorage.setItem(storageKey, created);
        return created;
    } catch (error) {
        return createFeedbackTrackingId('session');
    }
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
    this.sessionId = getFeedbackSessionId();
    this.quizId = null;
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
    this.quizId = createFeedbackTrackingId('quiz');
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

    // Report question button
    var existingReport = document.getElementById('qe-report-btn');
    if (existingReport) existingReport.parentNode.removeChild(existingReport);
    var reportBtn = document.createElement('button');
    reportBtn.id = 'qe-report-btn';
    reportBtn.className = 'question-report-btn';
    reportBtn.textContent = '\u26a0 Signaler cette question';
    reportBtn.hidden = true;
    reportBtn.addEventListener('click', function () { self.showQuestionReportModal(q); });
    options.parentNode.insertBefore(reportBtn, options.nextSibling);

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
        var reportBtn = document.getElementById('qe-report-btn');
        if (reportBtn) reportBtn.hidden = false;
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
            '<button class="question-report-btn answer-report-btn" data-question-index="' + i + '">\u26a0 Signaler cette question</button>' +
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
    this.container.querySelectorAll('.answer-report-btn').forEach(function (button) {
        button.addEventListener('click', function () {
            var questionIndex = parseInt(button.dataset.questionIndex, 10);
            self.showQuestionReportModal(self.preparedQuestions[questionIndex]);
        });
    });

    if (passed) {
        setTimeout(function () { self.showFeedbackPopup(); }, 1500);
    }
};

QuizEngine.prototype.showFeedbackPopup = function () {
    var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    var last = localStorage.getItem('feedback_last_shown');
    if (last && (Date.now() - parseInt(last, 10)) < THIRTY_DAYS) return;

    var self = this;
    var overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    overlay.innerHTML =
        '<div class="feedback-modal" role="dialog" aria-modal="true" aria-label="Votre avis">' +
            '<button class="feedback-modal-close" aria-label="Fermer">&times;</button>' +
            '<h3>Votre avis nous intéresse !</h3>' +
            '<div class="feedback-section">' +
                '<label>Satisfaction globale</label>' +
                '<div class="star-rating" id="fb-stars">' +
                    '<span data-val="1">&#9733;</span>' +
                    '<span data-val="2">&#9733;</span>' +
                    '<span data-val="3">&#9733;</span>' +
                    '<span data-val="4">&#9733;</span>' +
                    '<span data-val="5">&#9733;</span>' +
                '</div>' +
            '</div>' +
            '<div class="feedback-section">' +
                '<label>Niveau de difficulté</label>' +
                '<div class="feedback-radio-group">' +
                    '<label><input type="radio" name="fb-diff" value="easy"> Trop facile</label>' +
                    '<label><input type="radio" name="fb-diff" value="right"> Bien équilibré</label>' +
                    '<label><input type="radio" name="fb-diff" value="hard"> Trop difficile</label>' +
                '</div>' +
            '</div>' +
            '<div class="feedback-section">' +
                '<label>Recommanderiez-vous ce site ?</label>' +
                '<div class="feedback-toggle-group">' +
                    '<button class="feedback-toggle" data-val="1">Oui</button>' +
                    '<button class="feedback-toggle" data-val="0">Non</button>' +
                '</div>' +
            '</div>' +
            '<div class="feedback-section">' +
                '<label for="fb-comment">Commentaire (optionnel)</label>' +
                '<textarea id="fb-comment" rows="3" placeholder="Votre message..."></textarea>' +
            '</div>' +
            '<p id="fb-error" class="feedback-error" style="display:none;"></p>' +
            '<button class="primary-btn feedback-submit-btn" id="fb-submit" disabled>Envoyer</button>' +
        '</div>';

    document.body.appendChild(overlay);

    var selectedStars = 0;
    var selectedRecommend = null;
    var feedbackSubmissionId = createFeedbackTrackingId('feedback');
    var feedbackSubmitBtn = overlay.querySelector('#fb-submit');

    var starEls = overlay.querySelectorAll('#fb-stars span');
    starEls.forEach(function (star) {
        star.addEventListener('mouseover', function () {
            var val = parseInt(star.dataset.val);
            starEls.forEach(function (s) { s.classList.toggle('hovered', parseInt(s.dataset.val) <= val); });
        });
        star.addEventListener('mouseout', function () {
            starEls.forEach(function (s) { s.classList.remove('hovered'); });
        });
        star.addEventListener('click', function () {
            selectedStars = parseInt(star.dataset.val);
            starEls.forEach(function (s) { s.classList.toggle('selected', parseInt(s.dataset.val) <= selectedStars); });
            feedbackSubmitBtn.disabled = false;
            overlay.querySelector('#fb-error').style.display = 'none';
        });
    });

    overlay.querySelectorAll('.feedback-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            selectedRecommend = parseInt(btn.dataset.val);
            overlay.querySelectorAll('.feedback-toggle').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });

    function closeOverlay() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelector('.feedback-modal-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', escHandler); }
    });

    feedbackSubmitBtn.addEventListener('click', function () {
        if (feedbackSubmitBtn.dataset.submitting === 'true') return;
        var errorEl = overlay.querySelector('#fb-error');
        if (!selectedStars) {
            errorEl.textContent = 'Choisissez une note avant d’envoyer.';
            errorEl.style.display = '';
            return;
        }
        feedbackSubmitBtn.dataset.submitting = 'true';
        feedbackSubmitBtn.disabled = true;
        var difficulty = (overlay.querySelector('input[name="fb-diff"]:checked') || {}).value || null;
        var comment = document.getElementById('fb-comment').value.trim();
        var payload = {
            stars: selectedStars,
            difficulty: difficulty,
            would_recommend: selectedRecommend,
            comment: comment || null,
            level: self.level,
            mode: self.mode,
            question_id: null,
            quiz_id: self.quizId,
            session_id: self.sessionId,
            submission_id: feedbackSubmissionId
        };
        fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (r) {
            if (!r.ok) throw new Error('Enregistrement impossible');
            return r.json();
        }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Enregistrement impossible');
            localStorage.setItem('feedback_last_shown', String(Date.now()));
            var feedbackId = d.id;
            if (selectedRecommend === 1 && feedbackId) {
                var shareMsg = 'Marre des sites payants pour preparer le test civique ? J\'ai trouve une alternative 100% gratuite avec quiz, simulations et flashcards. Faites-moi confiance : https://www.test-civique-gratuit.com';
                var shareUrl = 'https://www.test-civique-gratuit.com';
                var encoded = encodeURIComponent(shareMsg);
                var encodedUrl = encodeURIComponent(shareUrl);
                function trackShare(platform) {
                    fetch('/api/feedback/' + feedbackId + '/share', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ platform: platform })
                    }).catch(function () {});
                }
                overlay.querySelector('.feedback-modal').innerHTML =
                    '<div class="share-screen">' +
                        '<p class="share-title">Merci ! Partagez avec vos amis 🎉</p>' +
                        '<div class="share-buttons">' +
                            '<a class="share-btn share-whatsapp" href="https://wa.me/?text=' + encoded + '" target="_blank" rel="noopener">WhatsApp</a>' +
                            '<a class="share-btn share-facebook" href="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '" target="_blank" rel="noopener">Facebook</a>' +
                            '<a class="share-btn share-x" href="https://x.com/intent/tweet?text=' + encoded + '" target="_blank" rel="noopener">X</a>' +
                            '<a class="share-btn share-reddit" href="https://www.reddit.com/submit?url=' + encodedUrl + '&title=' + encodeURIComponent('Test civique gratuit') + '" target="_blank" rel="noopener">Reddit</a>' +
                            '<a class="share-btn share-telegram" href="https://t.me/share/url?url=' + encodedUrl + '&text=' + encoded + '" target="_blank" rel="noopener">Telegram</a>' +
                            '<button class="share-btn share-copy" id="share-copy-btn">Copier le lien</button>' +
                        '</div>' +
                        '<a class="share-close" href="#" id="share-close-link">Fermer</a>' +
                    '</div>';
                overlay.querySelectorAll('.share-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var platform = (btn.className.match(/share-(whatsapp|facebook|x|reddit|telegram|copy)/) || [])[1];
                        if (platform) trackShare(platform);
                    });
                });
                document.getElementById('share-copy-btn').addEventListener('click', function () {
                    navigator.clipboard.writeText(shareUrl).then(function () {
                        document.getElementById('share-copy-btn').textContent = 'Copié ✓';
                    });
                });
                document.getElementById('share-close-link').addEventListener('click', function (e) {
                    e.preventDefault();
                    closeOverlay();
                });
            } else {
                overlay.querySelector('.feedback-modal').innerHTML =
                    '<p class="feedback-thanks">Merci pour votre retour !</p>';
                setTimeout(closeOverlay, 2000);
            }
        }).catch(function () {
            feedbackSubmitBtn.dataset.submitting = 'false';
            feedbackSubmitBtn.disabled = false;
            errorEl.textContent = 'L’envoi a échoué. Vous pouvez réessayer.';
            errorEl.style.display = '';
        });
    });
};

QuizEngine.prototype.showQuestionReportModal = function (q) {
    var self = this;
    var overlay = document.createElement('div');
    overlay.className = 'feedback-overlay';
    overlay.innerHTML =
        '<div class="feedback-modal" role="dialog" aria-modal="true" aria-label="Signaler une question">' +
            '<button class="feedback-modal-close" aria-label="Fermer">&times;</button>' +
            '<h3>Signaler cette question</h3>' +
            '<div class="feedback-section">' +
                '<label>Raison</label>' +
                '<div class="feedback-radio-group">' +
                    '<label><input type="radio" name="qr-reason" value="Réponse incorrecte"> Réponse incorrecte</label>' +
                    '<label><input type="radio" name="qr-reason" value="Formulation"> Formulation</label>' +
                    '<label><input type="radio" name="qr-reason" value="Contenu obsolète"> Contenu obsolète</label>' +
                    '<label><input type="radio" name="qr-reason" value="Hors programme"> Hors programme</label>' +
                '</div>' +
            '</div>' +
            '<p id="qr-error" class="feedback-error" style="display:none;"></p>' +
            '<button class="primary-btn feedback-submit-btn" id="qr-submit" disabled>Envoyer</button>' +
        '</div>';

    document.body.appendChild(overlay);

    var reportSubmissionId = createFeedbackTrackingId('question-report');
    var reportSubmitBtn = overlay.querySelector('#qr-submit');
    overlay.querySelectorAll('input[name="qr-reason"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            reportSubmitBtn.disabled = false;
            overlay.querySelector('#qr-error').style.display = 'none';
        });
    });

    function closeOverlay() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelector('.feedback-modal-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', escHandler); }
    });

    reportSubmitBtn.addEventListener('click', function () {
        if (reportSubmitBtn.dataset.submitting === 'true') return;
        var selected = overlay.querySelector('input[name="qr-reason"]:checked');
        var reason = selected ? selected.value : null;
        var errorEl = overlay.querySelector('#qr-error');
        if (!reason) {
            errorEl.textContent = 'Choisissez un motif avant d’envoyer.';
            errorEl.style.display = '';
            return;
        }
        reportSubmitBtn.dataset.submitting = 'true';
        reportSubmitBtn.disabled = true;
        var payload = {
            question_text: q.question,
            question_id: q.id,
            quiz_id: self.quizId,
            session_id: self.sessionId,
            level: self.level || null,
            theme: q.theme || null,
            reason: reason,
            submission_id: reportSubmissionId
        };
        fetch('/api/question-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (response) {
            if (!response.ok) throw new Error('Enregistrement impossible');
            return response.json();
        }).then(function (data) {
            if (!data.ok) throw new Error(data.error || 'Enregistrement impossible');
            overlay.querySelector('.feedback-modal').innerHTML =
                '<p class="feedback-thanks">Merci, nous examinerons cette question.</p>';
            setTimeout(closeOverlay, 2000);
        }).catch(function () {
            reportSubmitBtn.dataset.submitting = 'false';
            reportSubmitBtn.disabled = false;
            errorEl.textContent = 'L’envoi a échoué. Vous pouvez réessayer.';
            errorEl.style.display = '';
        });
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

QuizEngine.prototype.optionWordCount = function (text) {
    var normalized = String(text || '').trim();
    return normalized ? normalized.split(/\s+/).length : 0;
};

QuizEngine.prototype.optionDetailScore = function (text) {
    var value = String(text || '');
    var punctuation = (value.match(/[(),;:]/g) || []).length;
    var numbers = (value.match(/\b\d+\b/g) || []).length;
    return punctuation + numbers;
};

QuizEngine.prototype.selectBalancedWrongAnswers = function (correctAnswer, wrongAnswers, count) {
    var self = this;
    var correctWords = this.optionWordCount(correctAnswer);
    var correctDetails = this.optionDetailScore(correctAnswer);
    var ranked = wrongAnswers.map(function (answer) {
        var words = self.optionWordCount(answer);
        var details = self.optionDetailScore(answer);
        var lengthGap = Math.abs(words - correctWords) / Math.max(words, correctWords, 1);
        var detailGap = Math.abs(details - correctDetails) * 0.08;
        return { answer: answer, score: lengthGap + detailGap };
    }).sort(function (a, b) {
        return a.score - b.score;
    });

    // Keep a small pool of similarly structured distractors so wording still
    // varies between attempts without making answer length a clue.
    var poolSize = Math.min(ranked.length, Math.max(count, 5));
    return this.shuffleArray(ranked.slice(0, poolSize))
        .slice(0, count)
        .map(function (item) { return item.answer; });
};

QuizEngine.prototype.prepareQuestion = function (questionData) {
    var questionVariants = questionData.questions;
    var selectedQuestion = questionVariants[Math.floor(Math.random() * questionVariants.length)];
    var correctAnswersArray = questionData.correctAnswers || [questionData.correctAnswer];
    var selectedCorrectAnswer = correctAnswersArray[Math.floor(Math.random() * correctAnswersArray.length)];
    var shuffledWrongAnswers = this.selectBalancedWrongAnswers(selectedCorrectAnswer, questionData.wrongAnswers, 3);
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
