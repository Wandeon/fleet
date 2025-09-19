export function rememberSelected(ids: string[]) {
  localStorage.setItem('selectedDevices', JSON.stringify(ids));
}

export function loadSelected(): string[] {
  try {
    return JSON.parse(localStorage.getItem('selectedDevices') || '[]');
  } catch {
    return [];
  }
}

export function rememberTvSource(src: string) {
  localStorage.setItem('tvSource', src);
}

export function loadTvSource() {
  return localStorage.getItem('tvSource') || 'hdmi1';
}
