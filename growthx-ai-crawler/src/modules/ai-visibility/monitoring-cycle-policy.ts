/** Only scans scheduled under the 20-question/five-model plan consume its three monthly cycles.
 * Earlier ad-hoc scans remain historical evidence; their recorded costs and request usage
 * are still included in the router's independent monthly spending/request limits.
 */
export const LOW_COST_CYCLE_PREFIX = 'low-cost-v1:';
export function monthlyMonitoringCycles(organizationId: string, now = new Date()) {
  return {
    project: { organizationId },
    cycleId: { startsWith: LOW_COST_CYCLE_PREFIX },
    createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) },
  };
}
