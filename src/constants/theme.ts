export const C = {
  bg: '#F5F6FB',
  card: '#FFFFFF',
  text: '#111327',
  sub: '#5B6075',
  faint: '#9AA0B4',
  line: '#E6E8F0',
  primary: '#4F46E5',
  primarySoft: '#EEF0FF',
  twin: '#0EA5A4',
  twinSoft: '#E3F7F6',
  high: '#E5484D',
  highSoft: '#FDECEC',
  med: '#E58A00',
  medSoft: '#FFF4E0',
  low: '#2F9E62',
  lowSoft: '#E6F6EC',
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const R = { sm: 8, md: 14, lg: 20, pill: 999 };

export const scoreColor = (score: number) => (score >= 75 ? C.low : score >= 55 ? C.med : C.high);
