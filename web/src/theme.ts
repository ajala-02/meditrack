export const theme = {
  colors: {
    surface: '#FAFAFA',
    surfaceSecondary: '#FFFFFF',
    surfaceTertiary: '#F4F4F5',
    onSurface: '#111111',
    onSurfaceSecondary: '#111111',
    onSurfaceMuted: '#6B7280',
    onSurfaceTertiary: '#3F3F46',
    surfaceInverse: '#18181B',
    onSurfaceInverse: '#FFFFFF',
    brand: '#52796F',
    brandPrimary: '#354F52',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#84A98C',
    brandTertiary: '#CAD2C5',
    onBrandTertiary: '#2F3E46',
    success: '#386641',
    onSuccess: '#FFFFFF',
    warning: '#BC6C25',
    onWarning: '#FFFFFF',
    error: '#9B2226',
    onError: '#FFFFFF',
    border: '#E4E4E7',
    borderStrong: '#A1A1AA',
    divider: '#F4F4F5',
    // triage
    green: '#386641',
    yellow: '#BC6C25',
    red: '#9B2226',
    greenSoft: '#E7F0E5',
    yellowSoft: '#FCEAD3',
    redSoft: '#F8DADB',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    displayFamily: 'System',
    textFamily: 'System',
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
};

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export const riskColor = (l?: RiskLevel | null) => {
  if (l === 'RED') return { bg: theme.colors.redSoft, fg: theme.colors.red };
  if (l === 'YELLOW') return { bg: theme.colors.yellowSoft, fg: theme.colors.yellow };
  if (l === 'GREEN') return { bg: theme.colors.greenSoft, fg: theme.colors.green };
  return { bg: theme.colors.surfaceTertiary, fg: theme.colors.onSurfaceMuted };
};
