import { DeepPartial } from 'typeorm';
import { ThemeTemplate } from '../entities/theme-template.entity';

/**
 * Predefined theme templates seeded on first startup.
 * Each template provides a complete style configuration
 * (company colors, background, module colors) without logo/favicon.
 */
export const PREDEFINED_THEMES: DeepPartial<ThemeTemplate>[] = [
  {
    slug: 'professional-blue',
    name: 'Bleu Professionnel',
    description:
      'Un thème académique et épuré aux tons bleu profond, idéal pour les contextes professionnels.',
    category: 'predefined',
    sortOrder: 1,
    isActive: true,
    company: {
      primaryColor: '#1E40AF',
      background: { type: 'solid', color: '#0F172A' },
    },
    questions: {
      mainColor: '#3B82F6',
      backgroundColor: '#1E3A5F',
      badge: { iconName: 'comment', color: '#60A5FA' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#2563EB',
      backgroundColor: '#1E3A5F',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#1D4ED8',
      backgroundColor: '#172554',
      badge: { iconName: 'shield', color: '#93C5FD' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'warm-sunset',
    name: 'Coucher de Soleil',
    description:
      'Un thème chaleureux et accueillant avec des tons orangés rappelant un coucher de soleil.',
    category: 'predefined',
    sortOrder: 2,
    isActive: true,
    company: {
      primaryColor: '#EA580C',
      background: {
        type: 'gradient',
        gradient: {
          color1: '#7C2D12',
          color2: '#1C1917',
          direction: 'to-bottom',
        },
      },
    },
    questions: {
      mainColor: '#F97316',
      backgroundColor: '#7C2D12',
      badge: { iconName: 'comment', color: '#FDBA74' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#EA580C',
      backgroundColor: '#7C2D12',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#C2410C',
      backgroundColor: '#431407',
      badge: { iconName: 'shield', color: '#FED7AA' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'forest-green',
    name: 'Forêt Émeraude',
    description:
      'Un thème naturel et apaisant inspiré des forêts, parfait pour un environnement serein.',
    category: 'predefined',
    sortOrder: 3,
    isActive: true,
    company: {
      primaryColor: '#059669',
      background: { type: 'solid', color: '#064E3B' },
    },
    questions: {
      mainColor: '#10B981',
      backgroundColor: '#065F46',
      badge: { iconName: 'comment', color: '#6EE7B7' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#059669',
      backgroundColor: '#065F46',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#047857',
      backgroundColor: '#022C22',
      badge: { iconName: 'shield', color: '#A7F3D0' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'dark-mode',
    name: 'Mode Sombre',
    description:
      'Un thème élégant à faible luminosité avec des accents indigo, idéal pour une utilisation nocturne.',
    category: 'predefined',
    sortOrder: 4,
    isActive: true,
    company: {
      primaryColor: '#6366F1',
      background: { type: 'solid', color: '#020617' },
    },
    questions: {
      mainColor: '#818CF8',
      backgroundColor: '#1E1B4B',
      badge: { iconName: 'comment', color: '#A5B4FC' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#6366F1',
      backgroundColor: '#1E1B4B',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#4F46E5',
      backgroundColor: '#0F0A3C',
      badge: { iconName: 'shield', color: '#C7D2FE' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'minimalist',
    name: 'Minimaliste',
    description:
      'Un thème sobre et épuré qui met le contenu au premier plan avec des tons ardoise.',
    category: 'predefined',
    sortOrder: 5,
    isActive: true,
    company: {
      primaryColor: '#475569',
      background: { type: 'solid', color: '#1E293B' },
    },
    questions: {
      mainColor: '#64748B',
      backgroundColor: '#334155',
      badge: { iconName: 'comment', color: '#94A3B8' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#475569',
      backgroundColor: '#334155',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#334155',
      backgroundColor: '#0F172A',
      badge: { iconName: 'shield', color: '#CBD5E1' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'ocean-atlantic',
    name: 'Océan Atlantique',
    description:
      'Un thème profond et aquatique avec des dégradés bleu-cyan évoquant les profondeurs marines.',
    category: 'predefined',
    sortOrder: 6,
    isActive: true,
    company: {
      primaryColor: '#0891B2',
      background: {
        type: 'gradient',
        gradient: {
          color1: '#164E63',
          color2: '#0C4A6E',
          direction: 'to-bottom',
        },
      },
    },
    questions: {
      mainColor: '#06B6D4',
      backgroundColor: '#155E75',
      badge: { iconName: 'comment', color: '#67E8F9' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#0891B2',
      backgroundColor: '#155E75',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#0E7490',
      backgroundColor: '#083344',
      badge: { iconName: 'shield', color: '#A5F3FC' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'lavender-soft',
    name: 'Lavande Douce',
    description:
      'Un thème pastel et moderne aux tons violets, pour une atmosphère douce et créative.',
    category: 'predefined',
    sortOrder: 7,
    isActive: true,
    company: {
      primaryColor: '#7C3AED',
      background: { type: 'solid', color: '#2E1065' },
    },
    questions: {
      mainColor: '#8B5CF6',
      backgroundColor: '#3B0764',
      badge: { iconName: 'comment', color: '#C4B5FD' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#7C3AED',
      backgroundColor: '#3B0764',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#6D28D9',
      backgroundColor: '#1E0A46',
      badge: { iconName: 'shield', color: '#DDD6FE' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'coral-living',
    name: 'Corail Vivant',
    description: 'Un thème dynamique et engageant avec des tons corail et rose vifs.',
    category: 'predefined',
    sortOrder: 8,
    isActive: true,
    company: {
      primaryColor: '#E11D48',
      background: { type: 'solid', color: '#4C0519' },
    },
    questions: {
      mainColor: '#F43F5E',
      backgroundColor: '#881337',
      badge: { iconName: 'comment', color: '#FDA4AF' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#E11D48',
      backgroundColor: '#881337',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#BE123C',
      backgroundColor: '#4C0519',
      badge: { iconName: 'shield', color: '#FECDD3' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'golden-prestige',
    name: 'Or et Prestige',
    description: 'Un thème raffiné et haut de gamme avec des tons dorés et ambrés.',
    category: 'predefined',
    sortOrder: 9,
    isActive: true,
    company: {
      primaryColor: '#B45309',
      background: {
        type: 'gradient',
        gradient: {
          color1: '#451A03',
          color2: '#1C1917',
          direction: 'to-bottom',
        },
      },
    },
    questions: {
      mainColor: '#D97706',
      backgroundColor: '#78350F',
      badge: { iconName: 'comment', color: '#FCD34D' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#B45309',
      backgroundColor: '#78350F',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#92400E',
      backgroundColor: '#451A03',
      badge: { iconName: 'shield', color: '#FDE68A' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
  {
    slug: 'slate-charcoal',
    name: 'Ardoise et Charbon',
    description:
      'Un thème neutre et polyvalent avec un dégradé ardoise discret, adapté à tous les contextes.',
    category: 'predefined',
    sortOrder: 10,
    isActive: true,
    company: {
      primaryColor: '#334155',
      background: {
        type: 'gradient',
        gradient: {
          color1: '#0F172A',
          color2: '#1E293B',
          direction: 'to-bottom',
        },
      },
    },
    questions: {
      mainColor: '#475569',
      backgroundColor: '#1E293B',
      badge: { iconName: 'comment', color: '#94A3B8' },
      keyword: '@question',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#334155',
      backgroundColor: '#1E293B',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#1E293B',
      backgroundColor: '#0F172A',
      badge: { iconName: 'shield', color: '#CBD5E1' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
  },
];
