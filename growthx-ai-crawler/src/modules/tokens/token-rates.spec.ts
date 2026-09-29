import {
  DEFAULT_AI_INPUT_WEIGHT,
  DEFAULT_AI_OUTPUT_WEIGHT,
  DEFAULT_GEO_GRID_POINT_COST,
  DEFAULT_MONTHLY_ALLOWANCE,
  TokenAction,
  aiUsageTokens,
  estimateTokensFromChars,
  fixedPriceTokens,
  periodContaining,
  readTokenConfig,
  splitDebit,
} from './token-rates';

const env = (values: Record<string, string> = {}) => values as NodeJS.ProcessEnv;

describe('readTokenConfig', () => {
  it('enforces by default, with the documented starting prices', () => {
    expect(readTokenConfig(env())).toEqual({
      mode: 'enforce',
      monthlyAllowance: DEFAULT_MONTHLY_ALLOWANCE,
      aiInputWeight: DEFAULT_AI_INPUT_WEIGHT,
      aiOutputWeight: DEFAULT_AI_OUTPUT_WEIGHT,
      minimumToStartAi: 1,
      unitCosts: { [TokenAction.GEO_GRID_POINT]: DEFAULT_GEO_GRID_POINT_COST },
    });
  });

  it.each([
    ['shadow', 'shadow'],
    ['SHADOW', 'shadow'],
    [' off ', 'off'],
    ['enforce', 'enforce'],
  ])('reads TOKENS_ENFORCEMENT=%p as %p', (raw, expected) => {
    expect(readTokenConfig(env({ TOKENS_ENFORCEMENT: raw })).mode).toBe(expected);
  });

  it('treats an unrecognised mode as enforce rather than switching limits off by typo', () => {
    // A misspelt "shadow" must not quietly disable the ceiling, and a misspelt
    // "off" must not either: only the exact words relax anything.
    expect(readTokenConfig(env({ TOKENS_ENFORCEMENT: 'disabled' })).mode).toBe('enforce');
    expect(readTokenConfig(env({ TOKENS_ENFORCEMENT: 'false' })).mode).toBe('enforce');
  });

  it('reads overrides from the environment', () => {
    const config = readTokenConfig(
      env({
        TOKENS_MONTHLY_ALLOWANCE: '250000',
        TOKENS_AI_INPUT_WEIGHT: '0.5',
        TOKENS_AI_OUTPUT_WEIGHT: '3',
        TOKENS_MIN_TO_START_AI: '2000',
        TOKENS_COST_GEO_GRID_POINT: '750',
      }),
    );
    expect(config).toMatchObject({
      monthlyAllowance: 250_000,
      aiInputWeight: 0.5,
      aiOutputWeight: 3,
      minimumToStartAi: 2_000,
      unitCosts: { [TokenAction.GEO_GRID_POINT]: 750 },
    });
  });

  it.each(['abc', '-5', 'NaN', 'Infinity', '9999999999999', ''])(
    'falls back to the default for the unusable allowance %p',
    (raw) => {
      expect(readTokenConfig(env({ TOKENS_MONTHLY_ALLOWANCE: raw })).monthlyAllowance).toBe(DEFAULT_MONTHLY_ALLOWANCE);
    },
  );

  it('accepts an allowance of zero, which gives an account nothing until it is granted some', () => {
    expect(readTokenConfig(env({ TOKENS_MONTHLY_ALLOWANCE: '0' })).monthlyAllowance).toBe(0);
  });

  it('never lets the start threshold be zero, which would gate nothing', () => {
    expect(readTokenConfig(env({ TOKENS_MIN_TO_START_AI: '0' })).minimumToStartAi).toBe(1);
  });
});

describe('aiUsageTokens', () => {
  const config = readTokenConfig(env());

  it('weights output above input, at the default 1:4', () => {
    expect(aiUsageTokens(1_000, 0, config)).toBe(1_000);
    expect(aiUsageTokens(0, 1_000, config)).toBe(4_000);
    expect(aiUsageTokens(8_120, 1_340, config)).toBe(8_120 + 1_340 * 4);
  });

  it('rounds a fractional charge up, so a call that used anything is never free', () => {
    const half = readTokenConfig(env({ TOKENS_AI_INPUT_WEIGHT: '0.5', TOKENS_AI_OUTPUT_WEIGHT: '0.5' }));
    expect(aiUsageTokens(1, 0, half)).toBe(1);
    expect(aiUsageTokens(3, 0, half)).toBe(2);
  });

  it('charges nothing for a call that used nothing', () => {
    expect(aiUsageTokens(0, 0, config)).toBe(0);
  });

  it('ignores negative or non-numeric counts rather than crediting the customer', () => {
    expect(aiUsageTokens(-500, 100, config)).toBe(400);
    expect(aiUsageTokens(Number.NaN, 100, config)).toBe(400);
    expect(aiUsageTokens(Number.POSITIVE_INFINITY, 0, config)).toBe(0);
  });
});

describe('estimateTokensFromChars', () => {
  it('uses about four characters to a token, rounding up', () => {
    expect(estimateTokensFromChars(4)).toBe(1);
    expect(estimateTokensFromChars(5)).toBe(2);
    expect(estimateTokensFromChars(4_000)).toBe(1_000);
  });

  it('is zero for nothing or nonsense', () => {
    expect(estimateTokensFromChars(0)).toBe(0);
    expect(estimateTokensFromChars(-10)).toBe(0);
    expect(estimateTokensFromChars(Number.NaN)).toBe(0);
  });
});

describe('fixedPriceTokens', () => {
  const config = readTokenConfig(env());

  it('multiplies the unit price by the quantity', () => {
    expect(fixedPriceTokens(TokenAction.GEO_GRID_POINT, 25, config)).toBe(25 * DEFAULT_GEO_GRID_POINT_COST);
  });

  it('counts whole units only', () => {
    expect(fixedPriceTokens(TokenAction.GEO_GRID_POINT, 2.9, config)).toBe(2 * DEFAULT_GEO_GRID_POINT_COST);
    expect(fixedPriceTokens(TokenAction.GEO_GRID_POINT, -3, config)).toBe(0);
  });
});

describe('splitDebit', () => {
  it('draws the allowance down before touching bonus tokens', () => {
    expect(splitDebit(100, 50, 60)).toEqual({ fromAllowance: 60, fromBonus: 0, shortfall: 0 });
    expect(splitDebit(100, 50, 120)).toEqual({ fromAllowance: 100, fromBonus: 20, shortfall: 0 });
  });

  it('reports what neither bucket could cover instead of going negative', () => {
    expect(splitDebit(100, 50, 200)).toEqual({ fromAllowance: 100, fromBonus: 50, shortfall: 50 });
    expect(splitDebit(0, 0, 10)).toEqual({ fromAllowance: 0, fromBonus: 0, shortfall: 10 });
  });

  it('always accounts for every token asked for', () => {
    for (const [allowance, bonus, amount] of [
      [0, 0, 0],
      [5, 0, 5],
      [0, 5, 5],
      [3, 3, 7],
      [1_000_000, 1, 999_999],
    ]) {
      const { fromAllowance, fromBonus, shortfall } = splitDebit(allowance, bonus, amount);
      expect(fromAllowance + fromBonus + shortfall).toBe(amount);
      expect(fromAllowance).toBeLessThanOrEqual(allowance);
      expect(fromBonus).toBeLessThanOrEqual(bonus);
    }
  });
});

describe('periodContaining', () => {
  it('is the UTC calendar month', () => {
    const { start, end } = periodContaining(new Date('2026-09-29T23:59:59Z'));
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('starts a new period at the exact instant the month turns', () => {
    expect(periodContaining(new Date('2026-09-30T23:59:59.999Z')).end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(periodContaining(new Date('2026-10-01T00:00:00.000Z')).start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('rolls over the end of the year', () => {
    const { start, end } = periodContaining(new Date('2026-12-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
