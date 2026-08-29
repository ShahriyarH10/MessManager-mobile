/**
 * Design tokens — ported from css/01-variables.css.
 * The web app defaults to the dark theme; we follow the device setting and
 * fall back to dark.
 */
import { useColorScheme } from 'react-native';

export type Palette = {
  accent: string;
  accent2: string;
  amber: string;
  accentBg: string;
  amberBg: string;
  green: string;
  greenBg: string;
  red: string;
  redBg: string;
  blue: string;
  blueBg: string;
  purple: string;
  purpleBg: string;

  bg: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  bg5: string;
  border: string;
  border2: string;
  text: string;
  text2: string;
  text3: string;
};

const brand = {
  accent: '#d4a853',
  accent2: '#b8914a',
  amber: '#e0913a',
  amberBg: 'rgba(224,145,58,0.16)',
  accentBg: 'rgba(212,168,83,0.14)',
  green: '#4caf82',
  greenBg: 'rgba(76,175,130,0.14)',
  red: '#e05252',
  redBg: 'rgba(224,82,82,0.14)',
  blue: '#5b9bd5',
  blueBg: 'rgba(91,155,213,0.14)',
  purple: '#a78bfa',
  purpleBg: 'rgba(167,139,250,0.14)',
};

export const dark: Palette = {
  ...brand,
  bg: '#0f0f0f',
  bg1: '#131313',
  bg2: '#161616',
  bg3: '#1e1e1e',
  bg4: '#252525',
  bg5: '#2d2d2d',
  border: 'rgba(255,255,255,0.09)',
  border2: 'rgba(255,255,255,0.15)',
  text: '#f0ede8',
  text2: '#9a9690',
  text3: '#6f6c68',
};

export const light: Palette = {
  ...brand,
  bg: '#f5f3ef',
  bg1: '#f8f6f2',
  bg2: '#ffffff',
  bg3: '#f0ede8',
  bg4: '#e8e4de',
  bg5: '#dedad3',
  border: 'rgba(0,0,0,0.08)',
  border2: 'rgba(0,0,0,0.15)',
  text: '#1a1816',
  text2: '#6b6560',
  text3: '#9a9690',
};

export const radius = 16;
export const radiusSm = 10;

export function useTheme(): { colors: Palette; scheme: 'light' | 'dark' } {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return { colors: scheme === 'light' ? light : dark, scheme };
}

/** Avatar colour pairs — ported from PALETTE in js/core/config.js. */
export const AVATAR_PALETTE = [
  { bg: '#1a2a3a', fg: '#5b9bd5' },
  { bg: '#1a2e25', fg: '#4caf82' },
  { bg: '#2e1a1a', fg: '#e05252' },
  { bg: '#2a2218', fg: '#d4a853' },
  { bg: '#251a2e', fg: '#9b7fd4' },
  { bg: '#1e2a2a', fg: '#4cb8b8' },
  { bg: '#2e1f1a', fg: '#d47a4c' },
  { bg: '#1a1a2e', fg: '#7a7dd4' },
  { bg: '#1e2a1e', fg: '#6abf6a' },
  { bg: '#2e2420', fg: '#c49a6c' },
  { bg: '#2a1a24', fg: '#d47aaa' },
  { bg: '#1a2428', fg: '#5bbbd4' },
];

export function avatarCol(idOrIndex: string | number) {
  if (typeof idOrIndex === 'number') return AVATAR_PALETTE[idOrIndex % AVATAR_PALETTE.length];
  let h = 0;
  const s = String(idOrIndex);
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
