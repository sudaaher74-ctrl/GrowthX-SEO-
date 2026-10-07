export function brandTerms(projectName: string, domains: string[]): string[] {
  return [projectName, ...domains];
}

export function questionGroup(promptText: string, brand: string[]): string {
  return 'BUYER';
}
