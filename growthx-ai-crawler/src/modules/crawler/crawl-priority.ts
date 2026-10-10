/** Keep organization fairness, prioritize customer pages, and rotate within each group. */
export function prioritizeSites<T extends { website: { scope: string } }>(jobs: T[], turn: number): T[] {
  const rotate = (group: T[]) => group.length ? [...group.slice(turn % group.length), ...group.slice(0, turn % group.length)] : [];
  return [...rotate(jobs.filter(job => job.website.scope === 'own')), ...rotate(jobs.filter(job => job.website.scope !== 'own'))];
}
