export const AVATAR_PRESETS = ['sun', 'wave', 'leaf', 'orbit', 'spark', 'chat'] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

const presets: Record<AvatarPreset, { background: string; foreground: string; shape: string }> = {
  sun: { background: '#f5c453', foreground: '#171717', shape: '<circle cx="64" cy="64" r="25"/><path d="M64 17v13M64 98v13M17 64h13M98 64h13M31 31l10 10M87 87l10 10M97 31 87 41M41 87 31 97" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>' },
  wave: { background: '#3157d5', foreground: '#ffffff', shape: '<path d="M15 72c18-26 35-26 51 0s33 26 48 0v25H15z"/><path d="M15 51c18-25 35-25 51 0s33 25 48 0" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>' },
  leaf: { background: '#3f7a58', foreground: '#ffffff', shape: '<path d="M104 24C55 24 27 47 27 79c0 19 14 29 31 29 34 0 48-35 46-84z"/><path d="M35 101c15-24 31-39 57-58" fill="none" stroke="#d9eadf" stroke-width="7" stroke-linecap="round"/>' },
  orbit: { background: '#171717', foreground: '#f4f1ea', shape: '<circle cx="64" cy="64" r="14"/><ellipse cx="64" cy="64" rx="48" ry="22" fill="none" stroke="currentColor" stroke-width="7" transform="rotate(-25 64 64)"/><circle cx="105" cy="45" r="7" fill="#d84a36"/>' },
  spark: { background: '#8f4f78', foreground: '#ffffff', shape: '<path d="m64 14 10 34 34 10-34 10-10 34-10-34-34-10 34-10z"/><circle cx="99" cy="96" r="10" fill="#f5c453"/>' },
  chat: { background: '#d84a36', foreground: '#ffffff', shape: '<path d="M22 28h84v61H62l-25 20 5-20H22z"/><circle cx="45" cy="59" r="6" fill="#d84a36"/><circle cx="64" cy="59" r="6" fill="#d84a36"/><circle cx="83" cy="59" r="6" fill="#d84a36"/>' },
};

export function avatarPresetSvg(id: string) {
  if (!AVATAR_PRESETS.includes(id as AvatarPreset)) return null;
  const preset = presets[id as AvatarPreset];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><rect width="128" height="128" fill="${preset.background}"/><g fill="${preset.foreground}" color="${preset.foreground}">${preset.shape}</g></svg>`;
}
