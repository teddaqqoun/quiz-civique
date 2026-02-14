// FlashcardEngine — loads questions for a level+theme and renders card UI

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function FlashcardEngine(options) {
    this.level = options.level;
    this.theme = options.theme; // single theme slug
    this.containerId = options.containerId || 'flashcard-container';
    this.dataPath = options.dataPath || (getBasePath() + 'data/');

    this.cards = [];
    this.currentIndex = 0;
    this.flipped = false;
    this.container = null;
}

FlashcardEngine.prototype.init = function () {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;
    this.loadCards();
};

FlashcardEngine.prototype.loadCards = function () {
    var self = this;
    fetch(this.dataPath + this.level + '/' + this.theme + '.json')
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function (data) {
            self.cards = data.questions.map(function (q) {
                var correctAnswers = q.correctAnswers || [q.correctAnswer];
                var questionVariants = q.questions;
                var selectedQuestion = questionVariants[Math.floor(Math.random() * questionVariants.length)];
                return {
                    question: selectedQuestion,
                    answer: correctAnswers[0],
                    theme: q.theme
                };
            });
            self.currentIndex = 0;
            self.render();
        })
        .catch(function (err) {
            console.error('Erreur chargement flashcards:', err);
            self.container.innerHTML = '<p style="color:red;text-align:center;">Erreur lors du chargement des cartes.</p>';
        });
};

FlashcardEngine.prototype.render = function () {
    if (this.cards.length === 0) {
        this.container.innerHTML = '<p style="text-align:center;">Aucune carte disponible.</p>';
        return;
    }

    var card = this.cards[this.currentIndex];
    var total = this.cards.length;
    var idx = this.currentIndex;
    var self = this;

    this.container.innerHTML =
        '<div class="flashcard-progress">Carte ' + (idx + 1) + ' / ' + total + '</div>' +
        '<div class="flashcard-wrapper">' +
            '<div class="flashcard" id="fc-card">' +
                '<div class="flashcard-face flashcard-front">' +
                    '<div class="card-label">Question</div>' +
                    '<div class="card-question">' + escapeHtml(card.question) + '</div>' +
                '</div>' +
                '<div class="flashcard-face flashcard-back">' +
                    '<div class="card-label">Réponse</div>' +
                    '<div class="card-answer">' + escapeHtml(card.answer) + '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="flashcard-hint">Cliquez sur la carte pour la retourner</div>' +
        '<div class="flashcard-controls">' +
            '<button class="fc-btn" id="fc-prev"' + (idx === 0 ? ' disabled' : '') + '>Précédent</button>' +
            '<button class="fc-btn primary" id="fc-flip">Retourner</button>' +
            '<button class="fc-btn" id="fc-next"' + (idx === total - 1 ? ' disabled' : '') + '>Suivant</button>' +
            '<button class="fc-btn" id="fc-shuffle">Mélanger</button>' +
        '</div>';

    this.flipped = false;

    document.getElementById('fc-card').addEventListener('click', function () { self.flip(); });
    document.getElementById('fc-flip').addEventListener('click', function () { self.flip(); });
    document.getElementById('fc-prev').addEventListener('click', function () { self.prev(); });
    document.getElementById('fc-next').addEventListener('click', function () { self.next(); });
    document.getElementById('fc-shuffle').addEventListener('click', function () { self.shuffle(); });
};

FlashcardEngine.prototype.flip = function () {
    var card = document.getElementById('fc-card');
    if (!card) return;
    this.flipped = !this.flipped;
    if (this.flipped) {
        card.classList.add('flipped');
    } else {
        card.classList.remove('flipped');
    }
};

FlashcardEngine.prototype.prev = function () {
    if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
    }
};

FlashcardEngine.prototype.next = function () {
    if (this.currentIndex < this.cards.length - 1) {
        this.currentIndex++;
        this.render();
    }
};

FlashcardEngine.prototype.shuffle = function () {
    for (var i = this.cards.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = this.cards[i];
        this.cards[i] = this.cards[j];
        this.cards[j] = temp;
    }
    this.currentIndex = 0;
    this.render();
};
