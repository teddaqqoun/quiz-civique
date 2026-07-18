// Site-wide configuration
const SiteConfig = {
    siteName: 'Test Civique Gratuit',
    siteUrl: 'https://www.test-civique-gratuit.com',
    year: 2026,

    themes: [
        { slug: 'principes-valeurs', label: 'Principes et Valeurs', icon: '⚖️', file: 'principes-valeurs.json' },
        { slug: 'institutions', label: 'Institutions', icon: '🏛️', file: 'institutions.json' },
        { slug: 'droits-devoirs', label: 'Droits et Devoirs', icon: '📜', file: 'droits-devoirs.json' },
        { slug: 'histoire', label: 'Histoire', icon: '📚', file: 'histoire.json' },
        { slug: 'vie-societe', label: 'Vie en Société', icon: '🤝', file: 'vie-societe.json' }
    ],

    levels: {
        csp: {
            slug: 'csp',
            label: 'CSP',
            fullLabel: 'Carte de Séjour Pluriannuelle',
            description: 'Préparez l\'examen civique pour la Carte de Séjour Pluriannuelle',
            questionCount: 195
        },
        cr: {
            slug: 'cr',
            label: 'CR',
            fullLabel: 'Carte de Résident',
            description: 'Préparez l\'examen civique pour la Carte de Résident',
            questionCount: 209
        },
        nat: {
            slug: 'nat',
            label: 'Naturalisation',
            fullLabel: 'Naturalisation Française',
            description: 'Préparez l\'examen civique pour la Naturalisation Française',
            questionCount: 275
        }
    },

    exam: {
        questionCount: 40,
        timeMinutes: 45,
        passThreshold: 0.8,
        passScore: 32
    },

    themeLabels: {
        'principes-valeurs': 'Principes et Valeurs',
        'institutions': 'Institutions',
        'droits-devoirs': 'Droits et Devoirs',
        'histoire': 'Histoire',
        'vie-societe': 'Vie en Société'
    }
};
