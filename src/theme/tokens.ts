export const tokens = {
  color: {
    primary: {
      green: '#2E7D32',
      greenDark: '#1B5E20',
      leaf: '#66BB6A',
    },
    surface: {
      sand: '#F7F1E5',
      card: '#FFFDF9',
      muted: '#EEE7D8',
      sage: '#E7F0E4',
      gold: '#F6E6B9',
    },
    soil: {
      brown: '#8D6E63',
    },
    text: {
      primary: '#1F2D1F',
      muted: '#607060',
      inverse: '#FFFFFF',
    },
    border: {
      soft: '#E7DECE',
    },
    state: {
      success: '#2E7D32',
      warning: '#E5A935',
      danger: '#D8432E',
      info: '#1976D2',
      offline: '#8D6E63',
      neutral: '#E9E4DA',
    },
  },
  radius: {
    hero: 28,
    button: 16,
    card: 24,
    row: 18,
    chip: 999,
  },
  spacing: {
    page: 16,
    section: 20,
    card: 18,
    row: 14,
    control: 8,
  },
  typography: {
    h1: { size: 34, family: 'NotoSansThai_800ExtraBold', weight: '800' },
    h2: { size: 24, family: 'NotoSansThai_700Bold', weight: '700' },
    h3: { size: 18, family: 'NotoSansThai_600SemiBold', weight: '600' },
    body: { size: 17, family: 'NotoSansThai_400Regular', weight: '400' },
    metadata: { size: 14, family: 'NotoSansThai_600SemiBold', weight: '600' },
    caption: { size: 13, family: 'NotoSansThai_400Regular', weight: '400' },
  },
  depth: { card: { elevation: 2, shadowColor: '#3E4A35', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } } },
  contract: {
    'color.primary.green': '#2E7D32',
    'color.surface.sand': '#F7F1E5',
    'color.text.primary': '#1F2D1F',
    'radius.card': '24',
    'typography.body.size': '17',
  },
} as const;

export type Tokens = typeof tokens;
