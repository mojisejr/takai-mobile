export const tokens = {
  color: {
    primary: {
      green: '#2E7D32',
      greenDark: '#1B5E20',
      leaf: '#66BB6A',
    },
    surface: {
      sand: '#F4E9D8',
      card: '#FFFDF7',
      muted: '#F7F3EA',
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
      soft: '#E6DED0',
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
    button: 8,
    card: 12,
    chip: 999,
  },
  spacing: {
    page: 16,
    section: 16,
    card: 14,
    row: 12,
    control: 8,
  },
  typography: {
    h1: { size: 28, weight: '700' },
    h2: { size: 20, weight: '700' },
    h3: { size: 17, weight: '600' },
    body: { size: 16, weight: '400' },
    metadata: { size: 14, weight: '400' },
    caption: { size: 13, weight: '400' },
  },
  contract: {
    'color.primary.green': '#2E7D32',
    'color.surface.sand': '#F4E9D8',
    'color.text.primary': '#1F2D1F',
    'radius.card': '12',
    'typography.body.size': '16',
  },
} as const;

export type Tokens = typeof tokens;
