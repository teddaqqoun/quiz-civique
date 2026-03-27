// Shared components — header, footer, breadcrumbs, mobile nav

(function () {
    'use strict';

    // Calculate base path relative to root based on current page depth
    function getBasePath() {
        var path = window.location.pathname;
        var depth = (path.match(/\//g) || []).length - 1;
        if (depth <= 0) return './';
        var base = '';
        for (var i = 0; i < depth; i++) base += '../';
        return base;
    }

    window.getBasePath = getBasePath;

    function renderHeader(activePage) {
        var base = getBasePath();
        var el = document.getElementById('site-header');
        if (!el) return;

        el.innerHTML =
            '<header class="site-nav">' +
                '<div class="nav-container">' +
                    '<a href="' + base + 'index.html" class="nav-logo">' +
                        '<div class="nav-tricolor"><span class="tc-b"></span><span class="tc-w"></span><span class="tc-r"></span></div>' +
                        '<span class="nav-brand">Test Civique Gratuit</span>' +
                    '</a>' +
                    '<button class="hamburger" id="hamburger-btn" aria-label="Menu" aria-expanded="false">' +
                        '<span></span><span></span><span></span>' +
                    '</button>' +
                    '<nav class="nav-links" id="nav-links">' +
                        '<div class="nav-dropdown">' +
                            '<a href="' + base + 'quiz/index.html" class="nav-link' + (activePage === 'quiz' ? ' active' : '') + '">Quiz</a>' +
                            '<div class="dropdown-menu">' +
                                '<a href="' + base + 'quiz/csp.html">Quiz CSP</a>' +
                                '<a href="' + base + 'quiz/cr.html">Quiz CR</a>' +
                                '<a href="' + base + 'quiz/nat.html">Quiz Naturalisation</a>' +
                            '</div>' +
                        '</div>' +
                        '<div class="nav-dropdown">' +
                            '<a href="' + base + 'simulations/index.html" class="nav-link' + (activePage === 'simulations' ? ' active' : '') + '">Simulations</a>' +
                            '<div class="dropdown-menu">' +
                                '<a href="' + base + 'simulations/csp.html">Simulation CSP</a>' +
                                '<a href="' + base + 'simulations/cr.html">Simulation CR</a>' +
                                '<a href="' + base + 'simulations/nat.html">Simulation Naturalisation</a>' +
                            '</div>' +
                        '</div>' +
                        '<div class="nav-dropdown">' +
                            '<a href="' + base + 'flashcards/index.html" class="nav-link' + (activePage === 'flashcards' ? ' active' : '') + '">Flashcards</a>' +
                            '<div class="dropdown-menu">' +
                                '<a href="' + base + 'flashcards/csp/principes-valeurs.html">Flashcards CSP</a>' +
                                '<a href="' + base + 'flashcards/cr/principes-valeurs.html">Flashcards CR</a>' +
                                '<a href="' + base + 'flashcards/nat/principes-valeurs.html">Flashcards Naturalisation</a>' +
                            '</div>' +
                        '</div>' +
                        '<a href="' + base + 'guide/index.html" class="nav-link' + (activePage === 'guide' ? ' active' : '') + '">Guide</a>' +
                        '<a href="' + base + 'articles/index.html" class="nav-link' + (activePage === 'articles' ? ' active' : '') + '">Articles</a>' +
                        '<a href="' + base + 'faq.html" class="nav-link' + (activePage === 'faq' ? ' active' : '') + '">FAQ</a>' +
                    '</nav>' +
                '</div>' +
            '</header>';

        // Hamburger toggle
        var btn = document.getElementById('hamburger-btn');
        var nav = document.getElementById('nav-links');
        if (btn && nav) {
            btn.addEventListener('click', function () {
                var expanded = btn.getAttribute('aria-expanded') === 'true';
                btn.setAttribute('aria-expanded', String(!expanded));
                nav.classList.toggle('open');
                btn.classList.toggle('open');
            });
        }
    }

    function renderFooter() {
        var base = getBasePath();
        var el = document.getElementById('site-footer');
        if (!el) return;

        el.innerHTML =
            '<footer class="site-footer">' +
                '<div class="footer-container">' +
                    '<div class="footer-col">' +
                        '<h4>Quiz par niveau</h4>' +
                        '<a href="' + base + 'quiz/csp.html">Quiz CSP</a>' +
                        '<a href="' + base + 'quiz/cr.html">Quiz CR</a>' +
                        '<a href="' + base + 'quiz/nat.html">Quiz Naturalisation</a>' +
                    '</div>' +
                    '<div class="footer-col">' +
                        '<h4>Entraînement</h4>' +
                        '<a href="' + base + 'simulations/index.html">Simulations</a>' +
                        '<a href="' + base + 'flashcards/index.html">Flashcards</a>' +
                        '<a href="' + base + 'guide/index.html">Guide de révision</a>' +
                    '</div>' +
                    '<div class="footer-col">' +
                        '<h4>Ressources</h4>' +
                        '<a href="' + base + 'articles/index.html">Articles</a>' +
                        '<a href="' + base + 'faq.html">FAQ</a>' +
                        '<a href="' + base + 'a-propos.html">À propos</a>' +
                    '</div>' +
                    '<div class="footer-col">' +
                        '<h4>Liens officiels</h4>' +
                        '<a href="https://www.service-public.fr/" rel="noopener noreferrer" target="_blank">Service-Public.fr</a>' +
                        '<a href="https://www.immigration.interieur.gouv.fr/" rel="noopener noreferrer" target="_blank">Immigration.gouv.fr</a>' +
                    '</div>' +
                '</div>' +
                '<div class="footer-bottom">' +
                    '<p>&copy; ' + SiteConfig.year + ' ' + SiteConfig.siteName + ' — Préparation gratuite à l\'examen civique français</p>' +
                '</div>' +
            '</footer>';
    }

    function renderBreadcrumbs() {
        var el = document.getElementById('breadcrumbs');
        if (!el) return;
        var raw = el.getAttribute('data-crumbs');
        if (!raw) return;
        try {
            var items = JSON.parse(raw);
        } catch (e) { return; }
        var base = getBasePath();
        var html = '<nav class="breadcrumbs" aria-label="Fil d\'Ariane"><ol>';
        items.forEach(function (item, i) {
            var isLast = i === items.length - 1;
            if (isLast) {
                html += '<li><span aria-current="page">' + item.label + '</span></li>';
            } else {
                var href = item.url.charAt(0) === '/' ? base + item.url.slice(1) : item.url;
                html += '<li><a href="' + href + '">' + item.label + '</a></li>';
            }
        });
        html += '</ol></nav>';
        el.innerHTML = html;
    }

    function renderFeedbackButton() {
        var btn = document.createElement('button');
        btn.className = 'floating-feedback-btn';
        btn.setAttribute('aria-label', 'Feedback / Bug');
        btn.title = 'Feedback / Bug';
        btn.textContent = '\ud83d\udcac';
        document.body.appendChild(btn);

        btn.addEventListener('click', function () {
            var overlay = document.createElement('div');
            overlay.className = 'feedback-overlay';
            overlay.innerHTML =
                '<div class="feedback-modal" role="dialog" aria-modal="true" aria-label="Feedback">' +
                    '<button class="feedback-modal-close" aria-label="Fermer">&times;</button>' +
                    '<h3>Feedback / Signaler un bug</h3>' +
                    '<div class="feedback-section">' +
                        '<label>Type</label>' +
                        '<div class="feedback-radio-group">' +
                            '<label><input type="radio" name="br-type" value="bug" checked> Signaler un bug</label>' +
                            '<label><input type="radio" name="br-type" value="suggestion"> Suggestion</label>' +
                        '</div>' +
                    '</div>' +
                    '<div class="feedback-section">' +
                        '<label for="br-description">Description *</label>' +
                        '<textarea id="br-description" rows="4" placeholder="Décrivez le problème ou votre suggestion..." required></textarea>' +
                    '</div>' +
                    '<p id="br-error" class="feedback-error" style="display:none;">Veuillez entrer une description.</p>' +
                    '<button class="primary-btn feedback-submit-btn" id="br-submit">Envoyer</button>' +
                '</div>';

            document.body.appendChild(overlay);

            function closeOverlay() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
            overlay.querySelector('.feedback-modal-close').addEventListener('click', closeOverlay);
            overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', escHandler); }
            });

            document.getElementById('br-submit').addEventListener('click', function () {
                var desc = (document.getElementById('br-description') || {}).value;
                var errEl = document.getElementById('br-error');
                if (!desc || !desc.trim()) {
                    if (errEl) errEl.style.display = '';
                    return;
                }
                var payload = {
                    page_url: window.location.href,
                    description: desc.trim()
                };
                fetch('/api/bug-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(function () {});
                overlay.querySelector('.feedback-modal').innerHTML =
                    '<p class="feedback-thanks">Merci, votre retour a été enregistré !</p>';
                setTimeout(closeOverlay, 2000);
            });
        });
    }

    // Auto-init on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function () {
        var page = document.body.getAttribute('data-page') || '';
        renderHeader(page);
        renderFooter();
        renderBreadcrumbs();
        renderFeedbackButton();
    });
})();
