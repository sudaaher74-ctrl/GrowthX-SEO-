"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVisibilityReport = buildVisibilityReport;
function pct(numerator, denominator) {
    return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(1));
}
/** Monday 00:00 UTC of the week containing `date`. */
function weekStart(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // getUTCDay: 0 = Sunday, so Sunday belongs to the week that began 6 days prior.
    const offset = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
    return d;
}
/**
 * Turns raw prompt checks into the AI Visibility dashboard's numbers.
 *
 * `checks` must span both the reporting window and the preceding window of
 * equal length, so the period-over-period delta can be computed without a
 * second query. Checks that errored are counted but never fold into a rate —
 * an assistant we could not reach must not read as "did not cite you".
 */
function buildVisibilityReport(checks, options) {
    const { periodStart, periodEnd } = options;
    const windowMs = periodEnd.getTime() - periodStart.getTime();
    const previousStart = new Date(periodStart.getTime() - windowMs);
    const inWindow = (check, start, end) => check.checkedAt >= start && check.checkedAt < end;
    const current = checks.filter((c) => inWindow(c, periodStart, periodEnd));
    const previous = checks.filter((c) => inWindow(c, previousStart, periodStart));
    const ran = current.filter((c) => !c.error);
    const failedChecks = current.length - ran.length;
    const cited = ran.filter((c) => c.cited);
    const positions = cited.map((c) => c.position).filter((p) => typeof p === 'number');
    const averagePosition = positions.length
        ? Number((positions.reduce((sum, p) => sum + p, 0) / positions.length).toFixed(2))
        : null;
    const previousRan = previous.filter((c) => !c.error);
    const previousCitationSharePct = previousRan.length
        ? pct(previousRan.filter((c) => c.cited).length, previousRan.length)
        : null;
    const citationSharePct = pct(cited.length, ran.length);
    const deltaPt = previousCitationSharePct === null
        ? null
        : Number((citationSharePct - previousCitationSharePct).toFixed(1));
    // ---- per assistant
    const assistantMap = new Map();
    for (const check of ran) {
        const entry = assistantMap.get(check.assistant) ?? { checked: 0, cited: 0 };
        entry.checked += 1;
        if (check.cited)
            entry.cited += 1;
        assistantMap.set(check.assistant, entry);
    }
    const byAssistant = [...assistantMap.entries()]
        .map(([assistant, { checked, cited: c }]) => ({
        assistant,
        checked,
        cited: c,
        citationSharePct: pct(c, checked),
    }))
        .sort((a, b) => b.citationSharePct - a.citationSharePct);
    // ---- share of voice: how often each brand appears across the same answers
    const competitorCounts = new Map();
    for (const check of ran) {
        for (const domain of check.competitorsCited) {
            competitorCounts.set(domain, (competitorCounts.get(domain) ?? 0) + 1);
        }
    }
    const shareOfVoice = [
        { domain: null, label: 'You', mentions: cited.length, sharePct: pct(cited.length, ran.length) },
        ...[...competitorCounts.entries()].map(([domain, mentions]) => ({
            domain,
            label: options.competitorLabels?.[domain] ?? domain,
            mentions,
            sharePct: pct(mentions, ran.length),
        })),
    ].sort((a, b) => b.sharePct - a.sharePct);
    // ---- weekly trend across the reporting window
    const weekMap = new Map();
    for (const check of ran) {
        const key = weekStart(check.checkedAt).toISOString().slice(0, 10);
        const entry = weekMap.get(key) ?? { checked: 0, cited: 0 };
        entry.checked += 1;
        if (check.cited)
            entry.cited += 1;
        weekMap.set(key, entry);
    }
    const trend = [...weekMap.entries()]
        .map(([week, { checked, cited: c }]) => ({
        weekStart: week,
        checked,
        citationSharePct: pct(c, checked),
    }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        summary: {
            checked: ran.length,
            cited: cited.length,
            citationSharePct,
            averagePosition,
            previousCitationSharePct,
            deltaPt,
            failedChecks,
        },
        byAssistant,
        shareOfVoice,
        trend,
    };
}
//# sourceMappingURL=visibility-report.js.map