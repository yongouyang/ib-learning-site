import { describe, it, expect } from 'vitest';
import { createRng } from '@/lib/quiz-utils';
import {
  roundDp,
  roundSf,
  draw as drawRounding,
  build as buildRounding,
  type RoundingParams,
} from '@/content/generators/math-rounding';
import {
  draw as drawIndices,
  build as buildIndices,
  type IndicesParams,
} from '@/content/generators/math-indices';
import {
  draw as drawSpeed,
  build as buildSpeed,
  type SpeedParams,
} from '@/content/generators/phys-speed';
import {
  draw as drawStatistics,
  build as buildStatistics,
  type StatisticsParams,
} from '@/content/generators/math-statistics';
import {
  draw as drawSequence,
  build as buildSequence,
  type LinearSequenceParams,
} from '@/content/generators/math-linear-sequence';
import {
  draw as drawSubstitution,
  build as buildSubstitution,
  type SubstitutionParams,
} from '@/content/generators/math-substitution';
import {
  draw as drawShape,
  build as buildShape,
  type ShapeMeasureParams,
} from '@/content/generators/math-shape-measure';
import {
  type StandardFormParams,
} from '@/content/generators/math-standard-form';
import {
  type AlgebraManipulationParams,
} from '@/content/generators/math-algebra-manipulation';
import {
  type VolumeSurfaceParams,
} from '@/content/generators/math-volume-surface-area';
import {
  draw as drawFrequencyDensity,
  build as buildFrequencyDensity,
  type FrequencyDensityParams,
} from '@/content/generators/math-frequency-density';
import {
  draw as drawPressure,
  build as buildPressure,
  type PressureParams,
} from '@/content/generators/phys-pressure';
import {
  draw as drawDensity,
  build as buildDensity,
  type DensityParams,
} from '@/content/generators/phys-density';
import {
  draw as drawWaveSpeed,
  build as buildWaveSpeed,
  type WaveSpeedParams,
} from '@/content/generators/phys-wave-speed';
import {
  draw as drawThermal,
  build as buildThermal,
  type ThermalEnergyParams,
} from '@/content/generators/phys-thermal-energy';
import {
  draw as drawQuadratic,
  build as buildQuadratic,
  type QuadraticParams,
} from '@/content/generators/math-quadratic';
import {
  draw as drawFlashcardMatch,
  build as buildFlashcardMatch,
  type FlashcardMatchParams,
} from '@/content/generators/flashcard-match';
import { GENERATORS } from '@/content/generators';
import type { GeneratorOutput } from '@/content/generators/types';
import { fmtNumber } from '@/content/generators/utils';
import {
  draw as drawLinear,
  build as buildLinear,
  type LinearEquationParams,
} from '@/content/generators/math-linear-equation';
import {
  draw as drawPercent,
  type PercentOfAmountParams,
} from '@/content/generators/math-percent-of-amount';
import {
  draw as drawFraction,
  build as buildFraction,
  type FractionArithmeticParams,
} from '@/content/generators/math-fraction-arithmetic';
import {
  draw as drawOhms,
  build as buildOhms,
  type OhmsLawParams,
} from '@/content/generators/phys-v-ir';
import {
  draw as drawSeries,
  build as buildSeries,
  type SeriesResistanceParams,
} from '@/content/generators/phys-resistance-series';
import {
  draw as drawParallel,
  type ParallelResistanceParams,
} from '@/content/generators/phys-resistance-parallel';
import {
  draw as drawCharge,
  build as buildCharge,
  type ChargeCurrentParams,
} from '@/content/generators/phys-charge-current';
import {
  draw as drawKwh,
  type EnergyKwhParams,
} from '@/content/generators/phys-energy-kwh';
import {
  draw as drawFuse,
  type FuseRatingParams,
} from '@/content/generators/phys-fuse-rating';
import {
  draw as drawKe,
  type KineticEnergyParams,
} from '@/content/generators/phys-kinetic-energy';
import {
  draw as drawEfficiency,
  type EfficiencyParams,
} from '@/content/generators/phys-efficiency';
import {
  draw as drawPower,
  type PowerParams,
} from '@/content/generators/phys-power';
import {
  draw as drawElectronConfig,
  build as buildElectronConfig,
  type ElectronConfigParams,
} from '@/content/generators/chem-electron-config';
import {
  draw as drawIonFormation,
  build as buildIonFormation,
  type IonFormationParams,
} from '@/content/generators/chem-ion-formation';
import {
  draw as drawIsotopeRam,
  build as buildIsotopeRam,
  type IsotopeRamParams,
} from '@/content/generators/chem-isotope-ram';
import {
  draw as drawHalfLife,
  build as buildHalfLife,
  type HalfLifeParams,
} from '@/content/generators/chem-half-life';
import {
  draw as drawPhRatio,
  build as buildPhRatio,
  type PhRatioParams,
} from '@/content/generators/chem-ph-ratio';
import {
  draw as drawCompoundNaming,
  build as buildCompoundNaming,
  type CompoundNamingParams,
} from '@/content/generators/chem-compound-naming';
import {
  draw as drawAngle,
  build as buildAngle,
  paramsSchema as angleSchema,
  type AngleFactsParams,
} from '@/content/generators/math-angle-facts';
import {
  draw as drawProbability,
  build as buildProbability,
  paramsSchema as probabilitySchema,
  type ProbabilityParams,
} from '@/content/generators/math-probability';
import {
  draw as drawPythagoras,
  build as buildPythagoras,
  paramsSchema as pythagorasSchema,
  type PythagorasParams,
} from '@/content/generators/math-pythagoras-trig';
import {
  draw as drawCalculus,
  build as buildCalculus,
  paramsSchema as calculusSchema,
  poly,
  type CalculusParams,
  type Term,
} from '@/content/generators/math-calculus';
import {
  draw as drawVectors,
  build as buildVectors,
  paramsSchema as vectorsSchema,
  type VectorsParams,
} from '@/content/generators/math-vectors';
import {
  draw as drawStraightLine,
  build as buildStraightLine,
  line,
  negativeReciprocal,
  paramsSchema as straightLineSchema,
  type StraightLineParams,
} from '@/content/generators/math-straight-line';
import {
  choose,
  draw as drawBinomial,
  build as buildBinomial,
  paramsSchema as binomialSchema,
  pascalRow,
  type BinomialParams,
} from '@/content/generators/math-binomial';
import {
  draw as drawDecimal,
  build as buildDecimal,
  paramsSchema as decimalSchema,
  type DecimalArithmeticParams,
} from '@/content/generators/math-decimal-arithmetic';
import {
  draw as drawInteger,
  build as buildInteger,
  paramsSchema as integerSchema,
  type IntegerOperationsParams,
} from '@/content/generators/math-integer-operations';
import {
  draw as drawNumberBases,
  build as buildNumberBases,
  paramsSchema as numberBasesSchema,
  type NumberBasesParams,
} from '@/content/generators/math-number-bases';
import {
  draw as drawFactors,
  build as buildFactors,
  paramsSchema as factorsSchema,
  type FactorsMultiplesParams,
} from '@/content/generators/math-factors-multiples';
import {
  draw as drawDirected,
  build as buildDirected,
  paramsSchema as directedSchema,
  type DirectedNumbersParams,
} from '@/content/generators/math-directed-numbers';
import {
  draw as drawRatio,
  build as buildRatio,
  paramsSchema as ratioSchema,
  type RatioParams,
} from '@/content/generators/math-ratio';
import {
  draw as drawMeasures,
  build as buildMeasures,
  paramsSchema as measuresSchema,
  type MeasuresParams,
} from '@/content/generators/math-measures';
import {
  draw as drawCircle,
  build as buildCircle,
  paramsSchema as circleSchema,
  type CircleTheoremsParams,
} from '@/content/generators/math-circle-theorems';
import {
  draw as drawTrigRules,
  build as buildTrigRules,
  paramsSchema as trigRulesSchema,
  type TrigRulesParams,
} from '@/content/generators/math-trig-rules';
import {
  draw as drawTrigIdentities,
  build as buildTrigIdentities,
  paramsSchema as trigIdentitiesSchema,
  type TrigIdentitiesParams,
} from '@/content/generators/math-trig-identities';
import { chargeSuperscript, gcd } from '@/content/generators/utils';
import katex from 'katex';

// The param tables wired into the pilot topic JSONs.
const linearParams: LinearEquationParams = { a: [2, 3, 4, 5, 6], b: [1, 2, 3, 5, 7, 9], x: [2, 3, 4, 5, 6, 7, 8, 9] };
const percentParams: PercentOfAmountParams = { p: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95], n: [20, 40, 60, 80, 120, 140, 160, 200, 240, 300] };
const fractionParams: FractionArithmeticParams = { den1: [2, 3, 4, 5, 6], den2: [3, 4, 5, 6, 8], maxNum: 4 };
const ohmsParams: OhmsLawParams = { r: [2, 4, 5, 6, 10, 12, 20], i: [0.5, 1, 2, 3, 4, 5] };
const seriesParams: SeriesResistanceParams = { values: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20] };
const parallelParams: ParallelResistanceParams = { pairs: [[6, 3], [4, 12], [10, 10], [6, 12], [8, 8], [5, 20], [12, 24], [4, 4]] };
const chargeParams: ChargeCurrentParams = { i: [0.5, 1, 2, 3, 4, 5, 6], tSeconds: [10, 20, 30, 40, 60, 90, 120, 180, 240, 300] };
const kwhParams: EnergyKwhParams = { watts: [200, 400, 500, 800, 1000, 1500, 2000, 2500, 3000], hours: [0.5, 1, 2, 3, 4] };
const fuseParams: FuseRatingParams = { watts: [460, 920, 1380, 1610, 1840, 2070, 2300, 2530, 2760] };
const keParams: KineticEnergyParams = { m: [1, 2, 3, 4, 5, 6, 8, 10, 12], v: [2, 4, 6, 8, 10] };
const efficiencyParams: EfficiencyParams = { total: [200, 500, 1000], useful: [20, 40, 50, 60, 80, 100, 120, 150, 250] };
const powerParams: PowerParams = { force: [50, 100, 150, 200, 300, 400], distance: [2, 3, 4, 5, 6, 10], time: [2, 3, 4, 5, 6, 10, 12] };

function expectInvariants(out: GeneratorOutput) {
  const choices = [out.correct, ...out.distractors];
  expect(new Set(choices).size).toBe(4);
  for (const choice of choices) expect(choice.trim()).not.toBe('');
  expect(out.explanation.length).toBeGreaterThanOrEqual(20);
  expect(out.explanation).not.toBe(out.stem);
  for (const text of [out.stem, out.explanation, ...choices]) {
    expect(text).not.toMatch(/undefined|NaN|Infinity/);
  }
  // Every $...$ KaTeX segment must parse under strict mode, and the delimiters must
  // PAIR UP: an odd number of `$` means one math span was interpolated inside
  // another (e.g. `... so $3.6 = $3.6 \\times 10^8$$`), which the segment loop below
  // cannot see because the first pair still parses.
  for (const text of [out.stem, out.explanation, ...choices]) {
    expect((text.match(/\$/g) ?? []).length % 2).toBe(0);
    for (const segment of text.match(/\$[^$]+\$/g) ?? []) {
      const latex = segment.slice(1, -1);
      expect(() =>
        katex.renderToString(latex, { strict: true, throwOnError: true })
      ).not.toThrow();
    }
  }
}

// Run a generator over 100 seeds; check the universal invariants and that the
// correct choice matches an independent recomputation from the drawn values.
function sweep<P, V>(
  generatorId: string,
  params: P,
  draw: (params: P, rng: () => number) => V,
  build: (values: V, rng: () => number) => GeneratorOutput,
  expectedCorrect: (values: V) => string
) {
  for (let i = 0; i < 100; i++) {
    const rng = createRng(`sweep:${generatorId}:${i}`);
    const values = draw(params, rng);
    const out = build(values, rng);
    expectInvariants(out);
    expect(out.correct).toBe(expectedCorrect(values));
  }
}

describe('math-linear-equation', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-linear-equation'].generate(linearParams, createRng('golden:math-linear-equation'));
    expect(out).toEqual({
      stem: 'Solve $5x + 2 = 17$.',
      correct: '$x = 3$',
      distractors: ['$x = 3.8$', '$x = 4$', '$x = 2$'],
      explanation: 'Subtract 2: $5x = 15$, then divide by 5: $x = 3$. Check: $5(3) + 2 = 17$ ✓.',
    });
  });

  it('sweep: correct answer is the independent solution (c - b) / a', () => {
    sweep('math-linear-equation', linearParams, drawLinear, buildLinear, (v) => {
      expect(v.c).toBe(v.a * v.x + v.b);
      return `$x = ${fmtNumber((v.c - v.b) / v.a)}$`;
    });
  });

  it('handles a negative constant term', () => {
    const out = buildLinear({ a: 3, b: -5, x: 4, c: 7 }, createRng('neg'));
    expect(out.stem).toBe('Solve $3x - 5 = 7$.');
    expect(out.correct).toBe('$x = 4$');
    expect(out.explanation).toContain('Add 5');
  });

  it('works with single-value param tables (forced picks)', () => {
    const params = { a: [4], b: [8], x: [3] };
    const out = GENERATORS['math-linear-equation'].generate(params, createRng('forced'));
    expect(out.stem).toBe('Solve $4x + 8 = 20$.');
    expect(out.correct).toBe('$x = 3$');
    expectInvariants(out);
  });

  it('never offers a repeating-decimal distractor (the wrong-undo value is dropped when unclean)', () => {
    // a=3, b=1 makes the "added b instead of subtracting it" candidate x + 2/3,
    // which would print as 8.333333. Those draws must fall through to integer
    // near-misses instead.
    const params: LinearEquationParams = { a: [3], b: [1], x: [2, 4, 5, 7, 8] };
    for (let i = 0; i < 50; i++) {
      const out = GENERATORS['math-linear-equation'].generate(params, createRng(`clean:${i}`));
      for (const choice of out.distractors) expect(choice).toMatch(/^\$x = -?\d+(\.\d{1,2})?\$$/);
    }
  });
});

describe('math-percent-of-amount', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-percent-of-amount'].generate(percentParams, createRng('golden:math-percent-of-amount'));
    expect(out).toEqual({
      stem: 'Find 15% of 300.',
      correct: '45',
      distractors: ['0.45', '450', '315'],
      explanation: 'Use the multiplier 0.15: 300 × 0.15 = 45. So 15% of 300 is 45.',
    });
  });

  it('sweep: correct answer is p*n/100 and always an integer with these params', () => {
    sweep(
      'math-percent-of-amount',
      percentParams,
      drawPercent,
      (v, rng) => GENERATORS['math-percent-of-amount'].generate({ p: [v.p], n: [v.n] }, rng),
      (v) => fmtNumber((v.p * v.n) / 100)
    );
    for (let i = 0; i < 20; i++) {
      const v = drawPercent(percentParams, createRng(`pct:${i}`));
      expect(Number.isInteger((v.p * v.n) / 100)).toBe(true);
    }
  });
});

describe('math-fraction-arithmetic', () => {
  function expectedFraction(n1: number, d1: number, n2: number, d2: number): string {
    let num = n1 * d2 + n2 * d1;
    let den = d1 * d2;
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const h = g(num, den);
    num /= h;
    den /= h;
    const body = den === 1 ? String(num) : String.raw`\dfrac{${num}}{${den}}`;
    return `$${body}$`;
  }

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-fraction-arithmetic'].generate(fractionParams, createRng('golden:math-fraction-arithmetic'));
    expect(out).toEqual({
      stem: String.raw`Find $\dfrac{1}{4} + \dfrac{1}{6}$. Give your answer in its simplest form.`,
      correct: String.raw`$\dfrac{5}{12}$`,
      distractors: [String.raw`$\dfrac{1}{5}$`, String.raw`$\dfrac{1}{3}$`, String.raw`$\dfrac{1}{4}$`],
      explanation: String.raw`The lowest common denominator of 4 and 6 is 12: $\dfrac{1}{4} = \dfrac{3}{12}$ and $\dfrac{1}{6} = \dfrac{2}{12}$. Add the numerators: $\dfrac{5}{12}$.`,
    });
  });

  it('sweep: correct answer is the simplified sum', () => {
    sweep(
      'math-fraction-arithmetic',
      fractionParams,
      drawFraction,
      (v) => buildFraction(v),
      (v) => expectedFraction(v.n1, v.d1, v.n2, v.d2)
    );
  });

  it('draws a different second denominator when the lists overlap', () => {
    for (let i = 0; i < 20; i++) {
      const v = drawFraction({ den1: [4], den2: [4, 6], maxNum: 3 }, createRng(`den:${i}`));
      expect(v.d1).toBe(4);
      expect(v.d2).toBe(6);
    }
  });

  it('keeps stem fractions in lowest terms', () => {
    for (let i = 0; i < 50; i++) {
      const v = drawFraction(fractionParams, createRng(`cop:${i}`));
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
      expect(g(v.n1, v.d1)).toBe(1);
      expect(g(v.n2, v.d2)).toBe(1);
    }
  });

  it('build renders an improper answer when the sum exceeds 1', () => {
    const out = buildFraction({ n1: 3, d1: 4, n2: 1, d2: 2 });
    expect(out.correct).toBe(String.raw`$\dfrac{5}{4}$`);
    expectInvariants(out);
  });

  it('throws when den2 has no value different from den1', () => {
    expect(() =>
      GENERATORS['math-fraction-arithmetic'].generate({ den1: [4], den2: [4], maxNum: 2 }, createRng('x'))
    ).toThrow(/math-fraction-arithmetic/);
  });
});

describe('phys-v-ir', () => {
  it('golden output for a fixed seed (asks for R)', () => {
    const out = GENERATORS['phys-v-ir'].generate(ohmsParams, createRng('golden:phys-v-ir'));
    expect(out).toEqual({
      stem: 'A component has V = 50 V across it and carries a current of I = 5 A. What is its resistance?',
      correct: '10 Ω',
      distractors: ['250 Ω', '0.1 Ω', '45 Ω'],
      explanation: String.raw`Rearranging Ohm's Law: $R=\dfrac{V}{I}=\dfrac{50}{5}=10\ \Omega$.`,
    });
  });

  it('sweep: correct answer matches V = IR in whichever direction is asked', () => {
    sweep('phys-v-ir', ohmsParams, drawOhms, buildOhms, (v) => {
      expect(v.v).toBeCloseTo(v.r * v.i, 10);
      if (v.ask === 'V') return `${fmtNumber(v.r * v.i)} V`;
      if (v.ask === 'I') return `${fmtNumber(v.v / v.r)} A`;
      return `${fmtNumber(v.v / v.i)} Ω`;
    });
  });

  it('sweep covers all three ask directions', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(drawOhms(ohmsParams, createRng(`dir:${i}`)).ask);
    }
    expect(seen).toEqual(new Set(['V', 'I', 'R']));
  });

  it('drops non-positive distractor candidates (R - I when I > R)', () => {
    const out = buildOhms({ r: 2, i: 5, v: 10, ask: 'V' }, createRng('nonpos'));
    expectInvariants(out);
    for (const d of out.distractors) {
      expect(parseFloat(d)).toBeGreaterThan(0);
    }
  });
});

describe('phys-resistance-series', () => {
  it('golden output for a fixed seed (three resistors)', () => {
    const out = GENERATORS['phys-resistance-series'].generate(seriesParams, createRng('golden:phys-resistance-series'));
    expect(out).toEqual({
      stem: 'Three resistors, 5 Ω, 2 Ω and 10 Ω, are connected in series. What is the total resistance?',
      correct: '17 Ω',
      distractors: ['100 Ω', '15 Ω', '10 Ω'],
      explanation: String.raw`In series, resistances add: $R=5+2+10=17\ \Omega$. Adding is correct for series — the parallel formula would give a smaller value.`,
    });
  });

  it('sweep: correct answer is the sum of 2-3 distinct resistors', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`ser:${i}`);
      const v = drawSeries(seriesParams, rng);
      const out = buildSeries(v, rng);
      counts.add(v.resistors.length);
      expect(new Set(v.resistors).size).toBe(v.resistors.length);
      expectInvariants(out);
      expect(out.correct).toBe(`${fmtNumber(v.resistors.reduce((s, r) => s + r, 0))} Ω`);
    }
    expect(counts).toEqual(new Set([2, 3]));
  });
});

describe('phys-resistance-parallel', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-resistance-parallel'].generate(parallelParams, createRng('golden:phys-resistance-parallel'));
    expect(out).toEqual({
      stem: 'An 8 Ω and an 8 Ω resistor are connected in parallel. What is the total resistance?',
      correct: '4 Ω',
      distractors: ['16 Ω', '8 Ω', '0.25 Ω'],
      explanation: String.raw`For two resistors in parallel: $R=\dfrac{R_1 R_2}{R_1+R_2}=\dfrac{8\times8}{8+8}=\dfrac{64}{16}=4\ \Omega$. The 16 Ω option is the series sum — adding is wrong for parallel.`,
    });
  });

  it('sweep: correct answer is product over sum', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`par:${i}`);
      const v = drawParallel(parallelParams, rng);
      const out = GENERATORS['phys-resistance-parallel'].generate(parallelParams, createRng(`par:${i}`));
      expectInvariants(out);
      expect(out.correct).toBe(`${fmtNumber((v.r1 * v.r2) / (v.r1 + v.r2))} Ω`);
      expect(Number.isInteger((v.r1 * v.r2) / (v.r1 + v.r2))).toBe(true);
    }
  });
});

describe('phys-charge-current', () => {
  it('golden output for a fixed seed (minutes presentation)', () => {
    const out = GENERATORS['phys-charge-current'].generate(chargeParams, createRng('golden:phys-charge-current'));
    expect(out).toEqual({
      stem: 'A current of 1 A flows through a wire for 1 minute. How much charge passes?',
      correct: '60 C',
      distractors: ['1 C', '2 C', '30 C'],
      explanation: String.raw`Convert minutes to seconds first: 1 min = 60 s. Then $Q=It=1\times60=60\text{ C}$. Using 1 instead of 60 gives the 1 C trap.`,
    });
  });

  it('sweep: correct answer is I*t with t in seconds', () => {
    sweep('phys-charge-current', chargeParams, drawCharge, buildCharge, (v) => {
      expect(v.q).toBe(v.i * v.t);
      return `${fmtNumber(v.i * v.t)} C`;
    });
  });

  it('minutes presentation mentions the conversion; seconds does not', () => {
    const minutes = buildCharge({ i: 2, t: 180, inMinutes: true, q: 360 }, createRng('m'));
    expect(minutes.stem).toContain('3 minutes');
    expect(minutes.explanation).toContain('Convert minutes to seconds');
    expect(minutes.correct).toBe('360 C');
    const seconds = buildCharge({ i: 2, t: 30, inMinutes: false, q: 60 }, createRng('s'));
    expect(seconds.stem).toContain('30 seconds');
    expect(seconds.correct).toBe('60 C');
    expectInvariants(minutes);
    expectInvariants(seconds);
  });
});

describe('phys-energy-kwh', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-energy-kwh'].generate(kwhParams, createRng('golden:phys-energy-kwh'));
    expect(out).toEqual({
      stem: 'A 200 W appliance runs for 0.5 hours. How much energy does it use in kilowatt-hours?',
      correct: '0.1 kWh',
      distractors: ['100 kWh', '0.2 kWh', '400 kWh'],
      explanation: String.raw`Convert watts to kilowatts first: 200 W = 0.2 kW. Then $E=Pt=0.2\times0.5=0.1\text{ kWh}$. Using 200 directly gives the 100 kWh trap.`,
    });
  });

  it('sweep: correct answer is (watts/1000)*hours', () => {
    sweep(
      'phys-energy-kwh',
      kwhParams,
      drawKwh,
      (v, rng) => GENERATORS['phys-energy-kwh'].generate({ watts: [v.watts], hours: [v.hours] }, rng),
      (v) => `${fmtNumber((v.watts / 1000) * v.hours)} kWh`
    );
  });
});

describe('phys-fuse-rating', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-fuse-rating'].generate(fuseParams, createRng('golden:phys-fuse-rating'));
    expect(out).toEqual({
      stem: 'A 2070 W kettle runs on the 230 V mains supply. Which fuse rating should be fitted?',
      correct: '13 A',
      distractors: ['3 A', '5 A', '1 A'],
      explanation: String.raw`$I=\dfrac{P}{V}=\dfrac{2070}{230}=9\text{ A}$. Choose the next standard rating above 9 A, so a 13 A fuse. A lower fuse would melt in normal use; a higher one would not protect properly.`,
    });
  });

  it('sweep: correct fuse is the smallest standard rating above the current', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`fuse:${i}`);
      const v = drawFuse(fuseParams, rng);
      const out = GENERATORS['phys-fuse-rating'].generate(fuseParams, createRng(`fuse:${i}`));
      expectInvariants(out);
      const expected = [3, 5, 13].find((f) => v.watts / 230 < f);
      expect(out.correct).toBe(`${expected} A`);
      // Bands are unambiguous with these params: never exactly 3 or 5 A.
      expect([3, 5]).not.toContain(v.watts / 230);
    }
  });

  it('throws when the current exceeds the 13 A standard fuse', () => {
    expect(() =>
      GENERATORS['phys-fuse-rating'].generate({ watts: [4600] }, createRng('fuse:big'))
    ).toThrow(/phys-fuse-rating/);
  });
});

describe('phys-kinetic-energy', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-kinetic-energy'].generate(keParams, createRng('golden:phys-kinetic-energy'));
    expect(out).toEqual({
      stem: 'A 4 kg object moves at 10 m/s. What is its kinetic energy?',
      correct: '200 J',
      distractors: ['400 J', '40 J', '20 J'],
      explanation: String.raw`$KE=\dfrac{1}{2}mv^2=\dfrac{1}{2}\times4\times10^2=\dfrac{1}{2}\times4\times100=200\text{ J}$. Remember to square the speed before multiplying.`,
    });
  });

  it('sweep: correct answer is ½mv² and always an integer with these params', () => {
    sweep(
      'phys-kinetic-energy',
      keParams,
      drawKe,
      (v, rng) => GENERATORS['phys-kinetic-energy'].generate({ m: [v.m], v: [v.v] }, rng),
      (v) => {
        expect(Number.isInteger(0.5 * v.m * v.v * v.v)).toBe(true);
        return `${fmtNumber(0.5 * v.m * v.v * v.v)} J`;
      }
    );
  });
});

describe('phys-efficiency', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-efficiency'].generate(efficiencyParams, createRng('golden:phys-efficiency'));
    expect(out).toEqual({
      stem: 'A motor takes in 500 J of electrical energy and transfers 250 J as kinetic energy. What is its efficiency?',
      correct: '50%',
      distractors: ['2%', '0.5%', '60%'],
      explanation: String.raw`Efficiency $=\dfrac{\text{useful output}}{\text{total input}}\times100\%=\dfrac{250}{500}\times100\%=50\%$.`,
    });
  });

  it('sweep: correct answer is useful/total × 100', () => {
    sweep(
      'phys-efficiency',
      efficiencyParams,
      drawEfficiency,
      (v, rng) => GENERATORS['phys-efficiency'].generate({ total: [v.total], useful: [v.useful] }, rng),
      (v) => `${fmtNumber((v.useful / v.total) * 100)}%`
    );
  });

  it('filters useful values that exceed the drawn total', () => {
    for (let i = 0; i < 20; i++) {
      const v = drawEfficiency({ total: [200], useful: [50, 500] }, createRng(`eff:${i}`));
      expect(v.useful).toBe(50);
    }
  });
});

describe('phys-power', () => {
  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-power'].generate(powerParams, createRng('golden:phys-power'));
    expect(out).toEqual({
      stem: 'A hoist raises a 300 N engine block through 5 m in 12 s. What is its power output?',
      correct: '125 W',
      distractors: ['1500 W', '25 W', '18000 W'],
      explanation: String.raw`Work done first: $W=Fd=300\times5=1500\text{ J}$. Then $P=\dfrac{W}{t}=\dfrac{1500}{12}=125\text{ W}$. The 1500 W option forgets to divide by the time.`,
    });
  });

  it('sweep: correct answer is F*d/t with clean divisions', () => {
    sweep(
      'phys-power',
      powerParams,
      drawPower,
      (v, rng) => GENERATORS['phys-power'].generate({ force: [v.f], distance: [v.d], time: [v.t] }, rng),
      (v) => {
        expect((v.f * v.d) % v.t).toBe(0);
        return `${fmtNumber((v.f * v.d) / v.t)} W`;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Phase 3 chemistry generators. Param tables mirror what the topic JSONs will
// plausibly contain (all Z = 1..20 for electron config).

const CHEM_ELEMENTS = [
  { symbol: 'H', name: 'hydrogen', z: 1 },
  { symbol: 'He', name: 'helium', z: 2 },
  { symbol: 'Li', name: 'lithium', z: 3 },
  { symbol: 'Be', name: 'beryllium', z: 4 },
  { symbol: 'B', name: 'boron', z: 5 },
  { symbol: 'C', name: 'carbon', z: 6 },
  { symbol: 'N', name: 'nitrogen', z: 7 },
  { symbol: 'O', name: 'oxygen', z: 8 },
  { symbol: 'F', name: 'fluorine', z: 9 },
  { symbol: 'Ne', name: 'neon', z: 10 },
  { symbol: 'Na', name: 'sodium', z: 11 },
  { symbol: 'Mg', name: 'magnesium', z: 12 },
  { symbol: 'Al', name: 'aluminium', z: 13 },
  { symbol: 'Si', name: 'silicon', z: 14 },
  { symbol: 'P', name: 'phosphorus', z: 15 },
  { symbol: 'S', name: 'sulfur', z: 16 },
  { symbol: 'Cl', name: 'chlorine', z: 17 },
  { symbol: 'Ar', name: 'argon', z: 18 },
  { symbol: 'K', name: 'potassium', z: 19 },
  { symbol: 'Ca', name: 'calcium', z: 20 },
];

const electronConfigParams: ElectronConfigParams = { elements: CHEM_ELEMENTS };

const ionFormationParams: IonFormationParams = {
  elements: [
    { symbol: 'Na', name: 'sodium', z: 11, group: 1 },
    { symbol: 'K', name: 'potassium', z: 19, group: 1 },
    { symbol: 'Mg', name: 'magnesium', z: 12, group: 2 },
    { symbol: 'Ca', name: 'calcium', z: 20, group: 2 },
    { symbol: 'Al', name: 'aluminium', z: 13, group: 13 },
    { symbol: 'O', name: 'oxygen', z: 8, group: 16 },
    { symbol: 'S', name: 'sulfur', z: 16, group: 16 },
    { symbol: 'F', name: 'fluorine', z: 9, group: 17 },
    { symbol: 'Cl', name: 'chlorine', z: 17, group: 17 },
  ],
};

const isotopeRamParams: IsotopeRamParams = {
  pairs: [
    { element: 'chlorine', symbol: 'Cl', massA: 35, massB: 37, abundanceA: 75 },
    { element: 'copper', symbol: 'Cu', massA: 63, massB: 65, abundanceA: 69 },
    { element: 'boron', symbol: 'B', massA: 10, massB: 11, abundanceA: 20 },
    { element: 'bromine', symbol: 'Br', massA: 79, massB: 81, abundanceA: 51 },
    { element: 'neon', symbol: 'Ne', massA: 20, massB: 22, abundanceA: 90 },
  ],
};

const halfLifeParams: HalfLifeParams = {
  isotopes: [
    { name: 'iodine-131', halfLife: 8, unit: 'days', startMass: 100 },
    { name: 'carbon-14', halfLife: 5700, unit: 'years', startMass: 80 },
    { name: 'radon-222', halfLife: 3.8, unit: 'days', startMass: 64 },
    { name: 'cobalt-60', halfLife: 5.3, unit: 'years', startMass: 200 },
  ],
  halfLives: [2, 3, 4],
};

const phRatioParams: PhRatioParams = { deltaPowers: [1, 2, 3] };

const compoundNamingParams: CompoundNamingParams = {
  ionic: [
    { cationSymbol: 'Al', cationName: 'aluminium', cationCharge: 3, anionSymbol: 'O', anionName: 'oxide', anionCharge: 2, formula: 'Al₂O₃', name: 'aluminium oxide' },
    { cationSymbol: 'Mg', cationName: 'magnesium', cationCharge: 2, anionSymbol: 'O', anionName: 'oxide', anionCharge: 2, formula: 'MgO', name: 'magnesium oxide' },
    { cationSymbol: 'Na', cationName: 'sodium', cationCharge: 1, anionSymbol: 'Cl', anionName: 'chloride', anionCharge: 1, formula: 'NaCl', name: 'sodium chloride' },
    { cationSymbol: 'Ca', cationName: 'calcium', cationCharge: 2, anionSymbol: 'Cl', anionName: 'chloride', anionCharge: 1, formula: 'CaCl₂', name: 'calcium chloride' },
    { cationSymbol: 'K', cationName: 'potassium', cationCharge: 1, anionSymbol: 'O', anionName: 'oxide', anionCharge: 2, formula: 'K₂O', name: 'potassium oxide' },
  ],
  covalent: [
    { formula: 'N₂O₄', name: 'dinitrogen tetroxide' },
    { formula: 'SO₃', name: 'sulfur trioxide' },
    { formula: 'SO₂', name: 'sulfur dioxide' },
    { formula: 'CO₂', name: 'carbon dioxide' },
    { formula: 'CO', name: 'carbon monoxide' },
    { formula: 'NO₂', name: 'nitrogen dioxide' },
  ],
};

// Independent recomputation helpers (no imports from the generators' logic).
function testAufbau(z: number): number[] {
  const caps = [2, 8, 8, 2];
  const shells: number[] = [];
  let left = z;
  for (const cap of caps) {
    if (left <= 0) break;
    shells.push(Math.min(cap, left));
    left -= cap;
  }
  return shells;
}

function testGroupCharge(group: number): number {
  if (group === 1) return 1;
  if (group === 2) return 2;
  if (group === 13) return 3;
  if (group === 16) return -2;
  return -1;
}

function testCrissCross(catSym: string, catCharge: number, anSym: string, anCharge: number): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const h = g(catCharge, anCharge);
  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n: number) =>
    n > 1 ? String(n).split('').map((d) => SUBS[Number(d)]).join('') : '';
  return `${catSym}${sub(anCharge / h)}${anSym}${sub(catCharge / h)}`;
}

describe('chem-electron-config', () => {
  it('params schema accepts the Z=1..20 table', () => {
    expect(() => GENERATORS['chem-electron-config'].paramsSchema.parse(electronConfigParams)).not.toThrow();
  });

  it('sweep: correct answer matches an independent Aufbau in both modes', () => {
    const modes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`sweep:chem-electron-config:${i}`);
      const v = drawElectronConfig(electronConfigParams, rng);
      modes.add(v.mode);
      const out = buildElectronConfig(v, rng);
      expectInvariants(out);
      expect(out.correct).toBe(v.mode === 'to-config' ? testAufbau(v.z).join(',') : v.name);
    }
    expect(modes).toEqual(new Set(['to-config', 'to-element']));
  });

  it('spot: sodium (Z=11) is 2,8,1', () => {
    const out = buildElectronConfig(
      { mode: 'to-config', symbol: 'Na', name: 'sodium', z: 11, shells: [2, 8, 1], nameCandidates: [], namePool: [] },
      createRng('spot:ec')
    );
    expect(out.correct).toBe('2,8,1');
    expectInvariants(out);
  });

  it('spot: config 2,8,8,1 identifies potassium', () => {
    const out = buildElectronConfig(
      { mode: 'to-element', symbol: 'K', name: 'potassium', z: 19, shells: [2, 8, 8, 1], nameCandidates: ['argon', 'calcium'], namePool: CHEM_ELEMENTS.map((e) => e.name) },
      createRng('spot:ec2')
    );
    expect(out.correct).toBe('potassium');
    expectInvariants(out);
  });

  it('K/Ca distractors include the 2,8,9 / 2,8,10 period-confusion trap', () => {
    const k = buildElectronConfig(
      { mode: 'to-config', symbol: 'K', name: 'potassium', z: 19, shells: [2, 8, 8, 1], nameCandidates: [], namePool: [] },
      createRng('spot:ec3')
    );
    expect(k.correct).toBe('2,8,8,1');
    expect(k.distractors).toContain('2,8,9');
  });
});

describe('chem-ion-formation', () => {
  it('params schema accepts the groups 1/2/13/16/17 table', () => {
    expect(() => GENERATORS['chem-ion-formation'].paramsSchema.parse(ionFormationParams)).not.toThrow();
  });

  it('sweep: correct ion and ion config match the group rules', () => {
    const modes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`sweep:chem-ion-formation:${i}`);
      const v = drawIonFormation(ionFormationParams, rng);
      modes.add(v.mode);
      const out = buildIonFormation(v, rng);
      expectInvariants(out);
      const charge = testGroupCharge(v.group);
      if (v.mode === 'ion-charge') {
        expect(out.correct).toBe(`${v.symbol}${chargeSuperscript(Math.abs(charge), charge > 0 ? '+' : '-')}`);
      } else {
        expect(out.correct).toBe(testAufbau(v.z - charge).join(','));
      }
    }
    expect(modes).toEqual(new Set(['ion-charge', 'ion-config']));
  });

  it('spot: sodium forms Na⁺', () => {
    const out = buildIonFormation(
      { mode: 'ion-charge', symbol: 'Na', name: 'sodium', z: 11, group: 1 },
      createRng('spot:ion1')
    );
    expect(out.correct).toBe('Na⁺');
    expectInvariants(out);
  });

  it('spot: chloride ion is 2,8,8 and the atom config is a distractor', () => {
    const out = buildIonFormation(
      { mode: 'ion-config', symbol: 'Cl', name: 'chlorine', z: 17, group: 17 },
      createRng('spot:ion2')
    );
    expect(out.correct).toBe('2,8,8');
    expect(out.distractors).toContain('2,8,7');
    expectInvariants(out);
  });
});

describe('chem-isotope-ram', () => {
  it('params schema accepts the isotope-pair table', () => {
    expect(() => GENERATORS['chem-isotope-ram'].paramsSchema.parse(isotopeRamParams)).not.toThrow();
  });

  it('sweep: correct answer is the weighted mean rounded to 1 dp', () => {
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`sweep:chem-isotope-ram:${i}`);
      const v = drawIsotopeRam(isotopeRamParams, rng);
      const out = buildIsotopeRam(v, rng);
      expectInvariants(out);
      const raw = (v.abundanceA * v.massA + v.abundanceB * v.massB) / 100;
      expect(out.correct).toBe(fmtNumber(Math.round(raw * 10) / 10));
      expect(v.abundanceA + v.abundanceB).toBe(100);
    }
  });

  it('spot: chlorine 75/25 gives 35.5', () => {
    const out = buildIsotopeRam(
      { element: 'chlorine', symbol: 'Cl', massA: 35, massB: 37, abundanceA: 75, abundanceB: 25 },
      createRng('spot:ram')
    );
    expect(out.correct).toBe('35.5');
    expect(out.stem).toContain('³⁵Cl');
    expectInvariants(out);
  });
});

describe('chem-half-life', () => {
  it('params schema accepts the isotope table', () => {
    expect(() => GENERATORS['chem-half-life'].paramsSchema.parse(halfLifeParams)).not.toThrow();
  });

  it('sweep: remaining mass is start/2^n; elapsed is n half-lives', () => {
    const modes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`sweep:chem-half-life:${i}`);
      const v = drawHalfLife(halfLifeParams, rng);
      modes.add(v.mode);
      const out = buildHalfLife(v, rng);
      expectInvariants(out);
      if (v.mode === 'remaining') {
        expect(out.correct).toBe(`${fmtNumber(v.startMass / 2 ** v.n)} g`);
      } else {
        const elapsed = v.n * v.halfLife;
        expect(out.correct).toBe(`${fmtNumber(elapsed)} ${elapsed === 1 ? v.unit.slice(0, -1) : v.unit}`);
      }
    }
    expect(modes).toEqual(new Set(['remaining', 'elapsed']));
  });

  it('spot: iodine-131, 100 g, 8-day half-life, 3 half-lives leaves 12.5 g', () => {
    const out = buildHalfLife(
      { mode: 'remaining', name: 'iodine-131', halfLife: 8, unit: 'days', startMass: 100, n: 3 },
      createRng('spot:hl')
    );
    expect(out.correct).toBe('12.5 g');
    expectInvariants(out);
  });

  it('spot (inverse): 12.5 g from 100 g of iodine-131 means 24 days', () => {
    const out = buildHalfLife(
      { mode: 'elapsed', name: 'iodine-131', halfLife: 8, unit: 'days', startMass: 100, n: 3 },
      createRng('spot:hl2')
    );
    expect(out.correct).toBe('24 days');
    expect(out.stem).toContain('12.5 g remains');
    expectInvariants(out);
  });
});

describe('chem-ph-ratio', () => {
  it('params schema accepts the delta table', () => {
    expect(() => GENERATORS['chem-ph-ratio'].paramsSchema.parse(phRatioParams)).not.toThrow();
  });

  it('sweep: correct factor is 10^delta in both modes, pH values in range', () => {
    const modes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`sweep:chem-ph-ratio:${i}`);
      const v = drawPhRatio(phRatioParams, rng);
      modes.add(v.mode);
      const out = buildPhRatio(v, rng);
      expectInvariants(out);
      expect(out.correct).toBe(fmtNumber(10 ** v.delta));
      expect(v.phHigh - v.phLow).toBe(v.delta);
      if (v.mode === 'acidic') {
        expect(v.phHigh).toBeLessThanOrEqual(7);
      } else {
        expect(v.phLow).toBeGreaterThanOrEqual(7);
      }
    }
    expect(modes).toEqual(new Set(['acidic', 'alkaline']));
  });

  it('spot: pH 6 vs pH 3 is 1000 times more acidic', () => {
    const out = buildPhRatio(
      { mode: 'acidic', delta: 3, phLow: 3, phHigh: 6 },
      createRng('spot:ph')
    );
    expect(out.correct).toBe('1000');
    expect(out.distractors).toContain('3');
    expectInvariants(out);
  });

  it('includeAlkaline: false forces the acidic mode', () => {
    for (let i = 0; i < 20; i++) {
      const v = drawPhRatio({ deltaPowers: [2], includeAlkaline: false }, createRng(`phf:${i}`));
      expect(v.mode).toBe('acidic');
    }
  });
});

describe('chem-compound-naming', () => {
  it('params schema accepts the ionic/covalent tables and every ionic entry is charge-consistent', () => {
    expect(() => GENERATORS['chem-compound-naming'].paramsSchema.parse(compoundNamingParams)).not.toThrow();
    for (const entry of compoundNamingParams.ionic) {
      expect(testCrissCross(entry.cationSymbol, entry.cationCharge, entry.anionSymbol, entry.anionCharge)).toBe(entry.formula);
    }
  });

  it('sweep: correct answer matches criss-cross / the covalent table entry', () => {
    const modes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`sweep:chem-compound-naming:${i}`);
      const v = drawCompoundNaming(compoundNamingParams, rng);
      modes.add(v.mode);
      const out = buildCompoundNaming(v, rng);
      expectInvariants(out);
      if (v.mode === 'ionic-formula') {
        const e = v.ionic!;
        expect(out.correct).toBe(testCrissCross(e.cationSymbol, e.cationCharge, e.anionSymbol, e.anionCharge));
      } else if (v.mode === 'covalent-name') {
        expect(out.correct).toBe(v.covalent!.name);
      } else {
        expect(out.correct).toBe(v.covalent!.formula);
      }
    }
    expect(modes).toEqual(new Set(['ionic-formula', 'covalent-name', 'covalent-formula']));
  });

  it('spot: Al³⁺ and O²⁻ give Al₂O₃', () => {
    const out = buildCompoundNaming(
      {
        mode: 'ionic-formula',
        ionic: compoundNamingParams.ionic[0],
        covalent: null,
        ionicFormulaPool: compoundNamingParams.ionic.map((e) => e.formula),
        covalentNamePool: [],
        covalentFormulaPool: [],
      },
      createRng('spot:cn1')
    );
    expect(out.correct).toBe('Al₂O₃');
    expect(out.distractors).toContain('Al₃O₂');
    expectInvariants(out);
  });

  it('spot: N₂O₄ is dinitrogen tetroxide, and the reverse gives N₂O₄', () => {
    const base = {
      ionic: null,
      covalent: compoundNamingParams.covalent[0],
      ionicFormulaPool: [],
      covalentNamePool: compoundNamingParams.covalent.map((e) => e.name),
      covalentFormulaPool: compoundNamingParams.covalent.map((e) => e.formula),
    };
    const toName = buildCompoundNaming({ ...base, mode: 'covalent-name' as const }, createRng('spot:cn2'));
    expect(toName.correct).toBe('dinitrogen tetroxide');
    expectInvariants(toName);
    const toFormula = buildCompoundNaming({ ...base, mode: 'covalent-formula' as const }, createRng('spot:cn3'));
    expect(toFormula.correct).toBe('N₂O₄');
    expectInvariants(toFormula);
  });

  it('throws when the requested modes have no table entries', () => {
    expect(() =>
      GENERATORS['chem-compound-naming'].generate(
        { ionic: compoundNamingParams.ionic, covalent: [], modes: ['covalent-name'] },
        createRng('cn:empty')
      )
    ).toThrow(/chem-compound-naming/);
  });
});

describe('registry', () => {
  it('registers all 44 generators under kebab-case ids matching their module contract', () => {
    expect(Object.keys(GENERATORS).sort()).toEqual([
      'chem-compound-naming',
      'chem-electron-config',
      'chem-half-life',
      'chem-ion-formation',
      'chem-isotope-ram',
      'chem-ph-ratio',
      'flashcard-match',
      'math-algebra-manipulation',
      'math-angle-facts',
      'math-binomial',
      'math-calculus',
      'math-circle-theorems',
      'math-decimal-arithmetic',
      'math-directed-numbers',
      'math-factors-multiples',
      'math-fraction-arithmetic',
      'math-frequency-density',
      'math-indices',
      'math-integer-operations',
      'math-linear-equation',
      'math-linear-sequence',
      'math-measures',
      'math-number-bases',
      'math-percent-of-amount',
      'math-probability',
      'math-pythagoras-trig',
      'math-quadratic',
      'math-ratio',
      'math-rounding',
      'math-shape-measure',
      'math-standard-form',
      'math-statistics',
      'math-straight-line',
      'math-substitution',
      'math-trig-identities',
      'math-trig-rules',
      'math-vectors',
      'math-volume-surface-area',
      'phys-charge-current',
      'phys-density',
      'phys-efficiency',
      'phys-energy-kwh',
      'phys-fuse-rating',
      'phys-kinetic-energy',
      'phys-power',
      'phys-pressure',
      'phys-resistance-parallel',
      'phys-resistance-series',
      'phys-speed',
      'phys-thermal-energy',
      'phys-v-ir',
      'phys-wave-speed',
    ]);
    for (const [key, gen] of Object.entries(GENERATORS)) {
      expect(gen.id).toBe(key);
      expect(key).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

const roundingParams: RoundingParams = {
  dp: [1, 2],
  sf: [2, 3],
  values: [3.4567, 2.675, 0.04823, 8.999, 45.62, 0.3721, 12.348],
};
const indicesParams: IndicesParams = {
  symbols: ['x', 'a', 'y'],
  exponents: [2, 3, 4, 5],
  ops: ['multiply', 'divide', 'power'],
};
const speedParams: SpeedParams = {
  distances: [100, 400, 60, 1500, 200],
  times: [20, 50, 12, 300, 40],
  distanceUnit: 'm',
  timeUnit: 's',
};

describe('math-rounding', () => {
  it('params schema requires at least one of dp / sf', () => {
    expect(() => GENERATORS['math-rounding'].paramsSchema.parse({ values: [1.234, 2.345, 3.456] })).toThrow();
    expect(GENERATORS['math-rounding'].paramsSchema.parse(roundingParams)).toBeTruthy();
  });

  it('rounds with the exponent trick, not naive binary rounding', () => {
    // 2.675 is 2.6749999… in binary, so Math.round(2.675 * 100) / 100 gives 2.67.
    expect(roundDp(2.675, 2)).toBe(2.68);
    expect(roundDp(1.005, 2)).toBe(1.01);
    expect(roundDp(8.999, 1)).toBe(9);
    // 12463 to 3 s.f. needs a NEGATIVE shift; writing `e-${shift}` here produced
    // "e--2" and silently returned NaN.
    expect(roundSf(12463, 3)).toBe(12500);
    expect(roundSf(12463, 2)).toBe(12000);
    expect(roundSf(0.04823, 1)).toBe(0.05);
    expect(roundSf(0.04823, 2)).toBe(0.048);
  });

  it('sweep: answers match the target precision, padded, with valid choices', () => {
    for (let i = 0; i < 40; i++) {
      const values = drawRounding(roundingParams, createRng(`round:sweep:${i}`));
      const out = buildRounding(values, createRng(`round:sweep:${i}`));
      expectInvariants(out);
      if (values.mode === 'dp') {
        // A 2-d.p. answer must show exactly two decimals ("3.40", not "3.4").
        expect(out.correct).toMatch(new RegExp(`^\\d+\\.\\d{${values.target}}$`));
      }
      expect(out.correct).not.toMatch(/^-/);
    }
  });

  it('spot: 3.4567 to 2 d.p. is 3.46, and chopping to 3.45 is offered as the trap', () => {
    const values = { mode: 'dp' as const, target: 2, value: 3.4567, answer: roundDp(3.4567, 2) };
    const out = buildRounding(values, createRng('round:spot'));
    expect(out.correct).toBe('3.46');
    expect(out.distractors).toContain('3.45');
    expectInvariants(out);
  });

  it('does not re-round a distractor back onto the answer', () => {
    // Regression: an earlier build passed candidates through the answer's
    // formatter, so "rounded to 1 s.f. too finely" (2.7 for a 1 s.f. question)
    // collapsed onto the correct "3" and the generator then threw for want of
    // three unique choices.
    for (let i = 0; i < 12; i++) {
      const values = drawRounding(roundingParams, createRng(`round:collapse:${i}`));
      const out = buildRounding(values, createRng(`round:collapse:${i}`));
      expectInvariants(out);
      expect(out.distractors).not.toContain(out.correct);
    }
  });
});

describe('math-indices', () => {
  it('params schema accepts the symbol / exponent / op table', () => {
    expect(GENERATORS['math-indices'].paramsSchema.parse(indicesParams)).toBeTruthy();
  });

  it('sweep: each law transforms the exponents correctly', () => {
    for (let i = 0; i < 40; i++) {
      const values = drawIndices(indicesParams, createRng(`idx:sweep:${i}`));
      const out = buildIndices(values, createRng(`idx:sweep:${i}`));
      expectInvariants(out);
      const expected =
        values.op === 'multiply'
          ? values.m + values.n
          : values.op === 'divide'
            ? values.m - values.n
            : values.m * values.n;
      expect(values.answerExponent).toBe(expected);
      // The generator renders the simplified form: x^1 is `$x$`, x^0 is `$1$`.
      const rendered =
        expected === 1 ? `$${values.symbol}$` : expected === 0 ? '$1$' : `$${values.symbol}^{${expected}}$`;
      expect(out.correct).toBe(rendered);
    }
  });

  it('never emits a negative exponent or an unsimplified x^1 / x^0', () => {
    for (let i = 0; i < 60; i++) {
      const values = drawIndices(indicesParams, createRng(`idx:level:${i}`));
      const out = buildIndices(values, createRng(`idx:level:${i}`));
      for (const choice of [out.correct, ...out.distractors]) {
        expect(choice).not.toContain('^{-');
      }
      expect(out.correct).not.toBe('$x^{1}$');
      expect(out.correct).not.toBe('$x^{0}$');
    }
  });

  it('spot: the three laws', () => {
    expect(buildIndices({ symbol: 'x', op: 'multiply', m: 3, n: 4, answerExponent: 7 }, createRng('idx:s1')).correct).toBe('$x^{7}$');
    expect(buildIndices({ symbol: 'x', op: 'power', m: 3, n: 4, answerExponent: 12 }, createRng('idx:s2')).correct).toBe('$x^{12}$');
    expect(buildIndices({ symbol: 'x', op: 'divide', m: 5, n: 2, answerExponent: 3 }, createRng('idx:s3')).correct).toBe('$x^{3}$');
  });

  it('keeps \\times inside a single math span (a split span renders it as text)', () => {
    for (let i = 0; i < 20; i++) {
      const values = drawIndices({ ...indicesParams, ops: ['multiply'] }, createRng(`idx:span:${i}`));
      const out = buildIndices(values, createRng(`idx:span:${i}`));
      expect(out.stem).toMatch(/^Simplify \$[^$]+\\times[^$]+\$\.$/);
      expectInvariants(out);
    }
  });
});

describe('phys-speed', () => {
  it('params schema pairs m with s, or km with h', () => {
    expect(GENERATORS['phys-speed'].paramsSchema.parse(speedParams)).toBeTruthy();
    expect(
      GENERATORS['phys-speed'].paramsSchema.parse({ ...speedParams, distanceUnit: 'km', timeUnit: 'h' })
    ).toBeTruthy();
    expect(() =>
      GENERATORS['phys-speed'].paramsSchema.parse({ ...speedParams, distanceUnit: 'm', timeUnit: 'h' })
    ).toThrow();
  });

  it('throws instead of emitting an ugly quotient when no pair divides cleanly', () => {
    expect(() => drawSpeed({ distances: [7], times: [3] } as SpeedParams, createRng('speed:ugly'))).toThrow(
      /phys-speed/
    );
  });

  it('sweep: speed = distance / time in the params unit', () => {
    for (let i = 0; i < 30; i++) {
      const parsed = GENERATORS['phys-speed'].paramsSchema.parse(speedParams) as SpeedParams;
      const values = drawSpeed(parsed, createRng(`speed:sweep:${i}`));
      const out = buildSpeed(values, createRng(`speed:sweep:${i}`));
      expectInvariants(out);
      expect(out.correct).toBe(`${values.speed} ${values.speedUnit}`);
      expect(values.speed).toBeCloseTo(values.distance / values.time, 10);
    }
  });

  it('spot: 1500 m in 300 s is 5 m/s', () => {
    const out = buildSpeed(
      { distance: 1500, time: 300, speed: 5, distanceUnit: 'm', timeUnit: 's', speedUnit: 'm/s', scenario: 'A runner' },
      createRng('speed:spot')
    );
    expect(out.correct).toBe('5 m/s');
    expectInvariants(out);
  });

  it('does not offer the inverted quotient (0.008 km/h is not a student error)', () => {
    for (let i = 0; i < 20; i++) {
      const parsed = GENERATORS['phys-speed'].paramsSchema.parse({
        ...speedParams,
        distanceUnit: 'km',
        timeUnit: 'h',
      }) as SpeedParams;
      const values = drawSpeed(parsed, createRng(`speed:inv:${i}`));
      const out = buildSpeed(values, createRng(`speed:inv:${i}`));
      expect(out.distractors).not.toContain(`${values.time / values.distance} ${values.speedUnit}`);
    }
  });

  it('keeps the scenario physically plausible for the speed drawn', () => {
    // 60 m/s must not be described as a swimmer.
    for (let i = 0; i < 20; i++) {
      const values = drawSpeed(
        { distances: [1200, 1500], times: [20, 25], distanceUnit: 'm', timeUnit: 's' },
        createRng(`speed:plaus:${i}`),
      );
      const out = buildSpeed(values, createRng(`speed:plaus:${i}`));
      expect(out.stem).not.toMatch(/swimmer|walker/);
    }
  });
});



describe('math-statistics', () => {
  const params: StatisticsParams = { modes: ['mean', 'median', 'mode', 'range', 'missing-value'], counts: [5, 7], min: 3, max: 24 };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-statistics'].generate(params, createRng('golden:math-statistics'));
    expect(out).toEqual({
      stem: 'Seven numbers have a mean of $15$. Six of them are $13, 15, 17, 14, 17, 16$. What is the missing number?',
      correct: '13',
      distractors: ['15', '14', '12'],
      explanation: 'The 7 values total $7 \\times 15 = 105$. The 6 shown values add to $92$, so the missing number is $105 - 92 = 13$.',
    });
  });

  it('sweep: every mode matches an independent recomputation', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:math-statistics:${i}`);
      const values = drawStatistics(params, rng);
      const out = buildStatistics(values, rng);
      expectInvariants(out);
      const list = values.values;
      const sorted = [...list].sort((a, b) => a - b);
      const counts = list.map((v) => list.filter((w) => w === v).length);
      const modal = list[counts.indexOf(Math.max(...counts))];
      const expected: Record<string, number> = {
        mean: list.reduce((a, b) => a + b, 0) / list.length,
        median: sorted[(list.length - 1) / 2],
        mode: modal,
        range: Math.max(...list) - Math.min(...list),
        'missing-value': (values.total ?? 0) * (values.mean ?? 0) - list.reduce((a, b) => a + b, 0),
      };
      expect(out.correct).toBe(String(expected[values.mode]));
    }
  });

  it('never leaves a fractional answer (that is the whole point of the construction)', () => {
    for (let i = 0; i < 100; i++) {
      const out = GENERATORS['math-statistics'].generate(params, createRng(`whole:${i}`));
      expect(out.correct).toMatch(/^-?\d+$/);
    }
  });

  it('gives the mode question a unique most-frequent value, and the median an odd-sized set', () => {
    for (let i = 0; i < 60; i++) {
      const values = drawStatistics({ ...params, modes: ['mode'] }, createRng(`mode:${i}`));
      const frequency = new Map<number, number>();
      for (const v of values.values) frequency.set(v, (frequency.get(v) ?? 0) + 1);
      const highest = Math.max(...frequency.values());
      expect(highest).toBeGreaterThanOrEqual(2);
      // Exactly ONE value may carry the top frequency, or the mode is ambiguous.
      expect([...frequency.values()].filter((f) => f === highest)).toHaveLength(1);
    }
    for (let i = 0; i < 60; i++) {
      const values = drawStatistics({ ...params, modes: ['median'] }, createRng(`median:${i}`));
      expect(values.values.length % 2).toBe(1);
    }
  });

  it('rejects an even set size and a range too small for the constructions', () => {
    const parses = (p: Record<string, unknown>) => GENERATORS['math-statistics'].paramsSchema.safeParse(p).success;
    expect(parses({ counts: [4], min: 1, max: 20 })).toBe(false);
    expect(parses({ counts: [5], min: 1, max: 3 })).toBe(false);
    expect(parses({ counts: [5], min: 1, max: 20 })).toBe(true);
  });
});

describe('math-linear-sequence', () => {
  const params: LinearSequenceParams = {
    differences: [3, 4, 5, -2, -3, -7],
    firstTerms: [1, 2, 3, 5, 8, 12, 22, 31],
    termIndices: [5, 8, 11, 15],
    modes: ['next', 'nth-term', 'value-at-n', 'which-term', 'common-difference'],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-linear-sequence'].generate(params, createRng('golden:math-linear-sequence'));
    expect(out).toEqual({
      stem: 'Find the common difference of the sequence $31, 29, 27, 25, \\dots$.',
      correct: '-2',
      distractors: ['2', '-1', '-3'],
      explanation: 'Each term is found by subtracting $2$: $31 - 29 = 2$, so the common difference is $-2$.',
    });
  });

  it('sweep: the answer is the recomputed term, and no displayed term is non-positive', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:math-linear-sequence:${i}`);
      const values = drawSequence(params, rng);
      const out = buildSequence(values, rng);
      expectInvariants(out);
      const u = (k: number) => values.first + values.a * (k - 1);
      const shown = out.stem.match(/\$[^$]+\$/)![0].slice(1, -1);
      for (const raw of shown.split(',')) {
        if (/^-?\d+$/.test(raw.trim())) expect(Number(raw)).toBeGreaterThanOrEqual(1);
      }
      if (values.mode === 'next') expect(out.correct).toBe(fmtNumber(u(6)));
      if (values.mode === 'value-at-n') expect(out.correct).toBe(fmtNumber(u(values.n ?? 3)));
      if (values.mode === 'common-difference') expect(out.correct).toBe(fmtNumber(values.a));
      if (values.mode === 'which-term') {
        expect(out.correct).toBe(fmtNumber(values.n ?? 3));
        expect(Number(out.stem.match(/equals \$(\d+)\$/)![1])).toBe(u(values.n ?? 3));
      }
    }
  });

  it('renders the rule without a + 0 constant and without a 1 coefficient', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-linear-sequence'].generate({ ...params, modes: ['nth-term'] }, createRng(`rule:${i}`));
      expect(out.correct).toMatch(/^\$-?\d*n( [+-] \d+)?\$$/);
    }
  });

  it('keeps a which-term target above 1', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-linear-sequence'].generate({ ...params, modes: ['which-term'] }, createRng(`target:${i}`));
      expect(Number(out.stem.match(/equals \$(\d+)\$/)![1])).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects a zero common difference', () => {
    expect(GENERATORS['math-linear-sequence'].paramsSchema.safeParse({ ...params, differences: [0] }).success).toBe(false);
  });
});

describe('math-substitution', () => {
  const params: SubstitutionParams = {
    symbols: ['x', 'y', 'n'],
    coefficients: [1, 2, 3, 4, 5],
    constants: [-5, -3, 3, 7, 9],
    values: [-4, -3, -2, 3, 4, 5],
    modes: ['linear', 'quadratic'],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-substitution'].generate(params, createRng('golden:math-substitution'));
    expect(out).toEqual({
      stem: 'If $y = -2$, what is $4y^2 + 7$?',
      correct: '23',
      distractors: ['-9', '-1', '71'],
      explanation:
        'Substitute $y = -2$: $4(-2)^2 + 7 = 4 \\times 4 + 7 = 23$. The square applies to $y$ alone, before multiplying by $4$.',
    });
  });

  it('sweep: the answer is the evaluated expression', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:math-substitution:${i}`);
      const values = drawSubstitution(params, rng);
      const out = buildSubstitution(values, rng);
      expectInvariants(out);
      const expected = values.mode === 'quadratic' ? values.a * values.x ** 2 + values.b : values.a * values.x + values.b;
      expect(out.correct).toBe(fmtNumber(expected));
    }
  });

  it('brackets the substituted value so the sign is unambiguous', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-substitution'].generate(params, createRng(`bracket:${i}`));
      const x = Number(out.stem.match(/= (-?\d+)\$/)![1]);
      expect(out.explanation).toContain(`(${x})`);
      expect(out.stem).not.toMatch(/is \$1[a-z]/);
    }
  });

  it('never shows a bare 1 coefficient', () => {
    const out = GENERATORS['math-substitution'].generate(
      { symbols: ['x'], coefficients: [1], constants: [7], values: [3], modes: ['linear'] },
      createRng('coeff-one')
    );
    expect(out.stem).toBe('If $x = 3$, what is $x + 7$?');
    expect(out.correct).toBe('10');
  });
});

describe('math-shape-measure', () => {
  const params: ShapeMeasureParams = {
    shapes: ['rectangle', 'triangle', 'parallelogram', 'trapezium', 'circle'],
    asks: ['area', 'perimeter', 'circumference'],
    values: [3, 4, 5, 6, 7, 8, 10, 14],
    units: ['cm'],
    pi: '3.14',
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-shape-measure'].generate(params, createRng('golden:math-shape-measure'));
    expect(out).toEqual({
      stem: 'A triangle has base $14\\ \\text{cm}$ and perpendicular height $7\\ \\text{cm}$. What is its area?',
      correct: '$49\\ \\text{cm}^2$',
      distractors: ['$98\\ \\text{cm}^2$', '$21\\ \\text{cm}$', '$63\\ \\text{cm}^2$'],
      explanation:
        'Area of a triangle $= \\frac{1}{2} \\times \\text{base} \\times \\text{height} = \\frac{1}{2} \\times 14 \\times 7 = 49\\ \\text{cm}^2$. ($98\\ \\text{cm}^2$ is base × height without the half.)',
    });
  });

  it('sweep: the answer is the shape arithmetic, and non-circles are whole numbers', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:math-shape-measure:${i}`);
      const values = drawShape(params, rng);
      const out = buildShape(values, rng);
      expectInvariants(out);
      const [l, w, h] = values.dims;
      const expected: Record<string, number> = {
        rectangle: values.ask === 'area' ? l * w : 2 * (l + w),
        triangle: (l * w) / 2,
        parallelogram: l * w,
        trapezium: ((l + w) * h) / 2,
        circle: values.ask === 'area' ? values.pi * l * l : 2 * values.pi * l,
      };
      expect(out.correct).toContain(fmtNumber(expected[values.shape]));
      if (values.shape !== 'circle') expect(out.correct).toMatch(/^\$\d+\\ /);
    }
  });

  it('uses radii that are multiples of 7 when pi is 22/7', () => {
    const twentyTwoSevenths: ShapeMeasureParams = {
      shapes: ['circle'],
      asks: ['area', 'circumference'],
      values: [7, 14, 21],
      units: ['m'],
      pi: '22/7',
    };
    for (let i = 0; i < 40; i++) {
      const out = GENERATORS['math-shape-measure'].generate(twentyTwoSevenths, createRng(`227:${i}`));
      expect(Number(out.stem.match(/radius \$(\d+)/)![1]) % 7).toBe(0);
      expect(out.correct).toMatch(/^\$\d+\\ \\text{(cm|m)}/);
    }
    const bad = GENERATORS['math-shape-measure'].paramsSchema.safeParse({ shapes: ['circle'], values: [3, 5], pi: '22/7' });
    expect(bad.success).toBe(false);
  });

  it('falls back to an askable shape instead of throwing on a mixed param table', () => {
    const mixed: ShapeMeasureParams = {
      shapes: ['circle', 'rectangle'],
      asks: ['perimeter'],
      values: [4, 6],
      units: ['cm'],
      pi: '3.14',
    };
    for (let i = 0; i < 40; i++) {
      const out = GENERATORS['math-shape-measure'].generate(mixed, createRng(`mixed:${i}`));
      expect(out.stem).toContain('perimeter of a rectangle');
    }
  });
});

/** The last $...$ span of a generated string (the expression a question is about). */
function lastMathSpan(text: string): string {
  const spans = text.match(/\$[^$]+\$/g) ?? [];
  return spans[spans.length - 1] ?? '';
}

/**
 * Evaluate the small algebraic forms these generators emit (`3(x + 2)`,
 * `(x + 4)(x - 2)`, `x^2 + x - 2`) at a value of the variable. Substituting into
 * the STEM and into the ANSWER and comparing is real verification of a symbolic
 * answer — far stronger than comparing strings against a second renderer.
 */
function evalAlgebra(text: string, x: number): number {
  const s = text.replace(/\$/g, '').replace(/\\/g, '').replace(/\s+/g, '').replace(/×/g, '*');
  let i = 0;
  const peek = () => s[i];
  const isDigit = (c: string | undefined) => c !== undefined && /[0-9.]/.test(c);
  function factor(): number {
    if (peek() === '(') {
      i += 1;
      const inner = expr();
      i += 1; // ')'
      return inner;
    }
    if (peek() === '-') {
      i += 1;
      return -factor();
    }
    let digits = '';
    while (isDigit(peek())) digits += s[i++];
    let value = digits === '' ? 1 : Number(digits);
    if (peek() === 'x') {
      i += 1;
      if (peek() === '^') {
        i += 1;
        let power = '';
        while (isDigit(peek())) power += s[i++];
        value *= x ** Number(power);
      } else {
        value *= x;
      }
    }
    return value;
  }
  function term(): number {
    let value = factor();
    while (i < s.length && (peek() === '(' || isDigit(peek()) || peek() === 'x')) value *= factor();
    return value;
  }
  function expr(): number {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }
  return expr();
}

describe('math-standard-form', () => {
  const params: StandardFormParams = {
    mantissas: [1.5, 2.4, 3.7, 4.2, 5.6, 7.2, 8.5, 9.3],
    powers: [-4, -2, 2, 3, 5, 7],
    partners: [1.5, 2, 2.5, 4, 5],
    modes: ['to-standard', 'to-ordinary', 'multiply', 'divide'],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-standard-form'].generate(params, createRng('golden:math-standard-form'));
    expect(out).toEqual({
      stem: 'Write $3.7 \\times 10^{7}$ as an ordinary number.',
      correct: '$37\\,000\\,000$',
      distractors: ['$370\\,000\\,000$', '$3\\,700\\,000$', '$3.7$'],
      explanation: '$10^{7}$ moves the decimal point $7$ places right: $3.7 \\times 10^{7}$ = $37\\,000\\,000$.',
    });
  });

  /** `$3.7 \times 10^{7}$` -> { mantissa, exponent }. */
  function parse(text: string): { mantissa: number; exponent: number } {
    const match = text.match(/\$(-?[\d.]+) \\times 10\^\{?(-?\d+)\}?\$/);
    if (!match) throw new Error(`not standard form: ${text}`);
    return { mantissa: Number(match[1]), exponent: Number(match[2]) };
  }

  it('sweep: every answer is the same number as the stem, in standard form', () => {
    for (let i = 0; i < 100; i++) {
      const out = GENERATORS['math-standard-form'].generate(params, createRng(`sweep:math-standard-form:${i}`));
      expectInvariants(out);
      const ordinary = (text: string) => Number(text.replace(/\$/g, '').replace(/\\,/g, '').replace(/,/g, ''));
      const product = out.stem.match(/\(([\d.]+) \\times 10\^\{?(-?\d+)\}?\) (\\times|\\div) \(([\d.]+) \\times 10\^\{?(-?\d+)\}?\)/);
      if (product) {
        // "Simplify (a x 10^m) op (b x 10^n), giving your answer in standard form".
        const answer = parse(out.correct);
        const left = Number(product[1]) * 10 ** Number(product[2]);
        const right = Number(product[4]) * 10 ** Number(product[5]);
        const expected = product[3] === '\\times' ? left * right : left / right;
        // Relative comparison: these magnitudes run to 10^10, where an absolute tolerance is meaningless.
        expect((answer.mantissa * 10 ** answer.exponent) / expected).toBeCloseTo(1, 9);
        expect(answer.mantissa).toBeGreaterThanOrEqual(1);
        expect(answer.mantissa).toBeLessThan(10);
      } else if (/^Write .* in standard form\.$/.test(out.stem)) {
        // "Write 42 000 in standard form": the stem's ordinary number must equal the answer.
        const answer = parse(out.correct);
        expect(ordinary(lastMathSpan(out.stem)) / (answer.mantissa * 10 ** answer.exponent)).toBeCloseTo(1, 9);
      } else {
        // "Write a x 10^n as an ordinary number": the answer must equal that value.
        const { mantissa, exponent } = parse(lastMathSpan(out.stem));
        // Relative when the value is large, absolute when it is a small decimal.
        const value = mantissa * 10 ** exponent;
        expect(ordinary(out.correct) / value).toBeCloseTo(1, 9);
      }
    }
  });

  it('always normalises the mantissa into 1 <= m < 10', () => {
    for (let i = 0; i < 80; i++) {
      const out = GENERATORS['math-standard-form'].generate(
        { ...params, modes: ['multiply', 'divide'] },
        createRng(`normalise:${i}`)
      );
      const { mantissa, exponent } = parse(out.correct);
      expect(mantissa).toBeGreaterThanOrEqual(1);
      expect(mantissa).toBeLessThan(10);
      expect(Number.isFinite(exponent)).toBe(true);
    }
  });
});

describe('math-algebra-manipulation', () => {
  const params: AlgebraManipulationParams = {
    modes: ['expand-bracket', 'factorise-common', 'expand-binomials', 'factorise-quadratic', 'difference-of-squares'],
    symbols: ['x'],
    coefficients: [2, 3, 4, 5],
    constants: [2, 3, 4, 5, 7, 9],
    negatives: true,
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-algebra-manipulation'].generate(params, createRng('golden:math-algebra-manipulation'));
    expect(out).toEqual({
      stem: 'Expand $(x + 2)(x - 1)$.',
      correct: '$x^2 + x - 2$',
      distractors: ['$x^2 - x - 2$', '$x^2 + 3x + 2$', '$x^2 + 2x$'],
      explanation:
        'Multiply every term of the first bracket by every term of the second: $x^2 + x - 2$, from $2 \\times (-1) = -2$ and $2 + (-1) = 1$.',
    });
  });

  it('sweep: the answer is equal to the stem at every value of x', () => {
    for (let i = 0; i < 120; i++) {
      const out = GENERATORS['math-algebra-manipulation'].generate(params, createRng(`sweep:algebra:${i}`));
      expectInvariants(out);
      const stem = lastMathSpan(out.stem);
      const answer = lastMathSpan(out.correct);
      for (const x of [0, 1, 2, 5, -3]) {
        expect(evalAlgebra(answer, x)).toBeCloseTo(evalAlgebra(stem, x), 9);
      }
    }
  });

  it('evaluator self-check (the test above is only as good as this)', () => {
    expect(evalAlgebra('$3(x + 2)$', 4)).toBe(18);
    expect(evalAlgebra('$x^2 + x - 2$', 3)).toBe(10);
    expect(evalAlgebra('$(x + 4)(x - 2)$', 5)).toBe(27);
    expect(evalAlgebra('$4x + 12$', 2)).toBe(20);
    expect(evalAlgebra('$-x^2 + 3$', 2)).toBe(-1);
  });
});

describe('math-volume-surface-area', () => {
  const params: VolumeSurfaceParams = {
    modes: ['cuboid-volume', 'cuboid-surface', 'prism-volume', 'prism-surface', 'cylinder-volume', 'cylinder-curved', 'cylinder-surface'],
    values: [2, 3, 4, 5, 6, 8, 10, 12],
    units: ['cm'],
    pi: '3.14',
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-volume-surface-area'].generate(params, createRng('golden:math-volume-surface-area'));
    expect(out).toEqual({
      stem: 'Find the surface area of a cuboid with length $8\\ \\text{cm}$, width $3\\ \\text{cm}$, and height $12\\ \\text{cm}$.',
      correct: '$312\\ \\text{cm}^2$',
      distractors: ['$288\\ \\text{cm}^3$', '$156\\ \\text{cm}^2$', '$288\\ \\text{cm}^2$'],
      explanation:
        'Surface area $= 2(lw + lh + wh) = 2(24 + 96 + 36) = 312\\ \\text{cm}^2$. ($288\\ \\text{cm}^3$ is the volume.)',
    });
  });

  it('sweep: every answer matches the formula for its mode', () => {
    for (let i = 0; i < 120; i++) {
      const out = GENERATORS['math-volume-surface-area'].generate(params, createRng(`sweep:volume:${i}`));
      expectInvariants(out);
      const answer = Number(out.correct.match(/\$([\d.]+)\\/)![1]);
      if (out.stem.startsWith('What is the volume of a cuboid') || out.stem.startsWith('Find the surface area of a cuboid')) {
        const dims = [...out.stem.matchAll(/\$(\d+)\\/g)].map((m) => Number(m[1]));
        expect(dims).toHaveLength(3);
        const [l, w, h] = dims;
        const expected = out.stem.includes('surface area') ? 2 * (l * w + l * h + w * h) : l * w * h;
        expect(answer).toBeCloseTo(expected, 6);
      } else if (out.stem.includes('prism')) {
        const dims = [...out.stem.matchAll(/\$(\d+)\\/g)].map((m) => Number(m[1]));
        const [leg1, leg2, length] = dims;
        const endArea = (leg1 * leg2) / 2;
        const third = Math.sqrt(leg1 * leg1 + leg2 * leg2);
        const expected = out.stem.includes('total surface') ? 2 * endArea + (leg1 + leg2 + third) * length : endArea * length;
        expect(answer).toBeCloseTo(expected, 6);
        if (out.stem.includes('total surface')) expect(Number.isInteger(answer)).toBe(true);
      } else {
        const dims = [...out.stem.matchAll(/\$(\d+)\\/g)].map((m) => Number(m[1]));
        const [r, h] = dims;
        const expected = out.stem.includes('volume')
          ? 3.14 * r * r * h
          : out.stem.includes('CURVED')
            ? 2 * 3.14 * r * h
            : 2 * 3.14 * r * h + 2 * 3.14 * r * r;
        expect(answer).toBeCloseTo(expected, 6);
      }
    }
  });

  it('only offers prism surface area when the triangle has an integer hypotenuse', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-volume-surface-area'].generate(
        { ...params, modes: ['prism-surface'], values: [3, 4, 5, 6, 8, 10] },
        createRng(`triple:${i}`)
      );
      expect(Number.isInteger(Number(out.correct.match(/\$([\d.]+)\\/)![1]))).toBe(true);
    }
    // No Pythagorean pair anywhere -> the mode is dropped rather than throwing.
    for (let i = 0; i < 20; i++) {
      const out = GENERATORS['math-volume-surface-area'].generate(
        { ...params, modes: ['prism-surface', 'cuboid-volume'], values: [2, 5, 7, 11] },
        createRng(`noprith:${i}`)
      );
      expect(out.stem.startsWith('What is the volume of a cuboid')).toBe(true);
    }
  });
});

describe('math-frequency-density', () => {
  const params: FrequencyDensityParams = {
    modes: ['density', 'frequency', 'width'],
    densities: [2, 3, 4, 5, 6, 8],
    widths: [3, 4, 5, 8, 10, 12, 15],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-frequency-density'].generate(params, createRng('golden:math-frequency-density'));
    expect(out).toEqual({
      stem: 'A histogram bar for a class of width 12 has a height (frequency density) of 6. What is the frequency?',
      correct: '72',
      distractors: ['12', '6', '18'],
      explanation: 'Frequency = frequency density × class width = $6 \\times 12 = 72$. The option 12 stops at the class width.',
    });
  });

  it('sweep: the answer is the drawn value the question asks for', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:fd:${i}`);
      const values = drawFrequencyDensity(params, rng);
      const out = buildFrequencyDensity(values, rng);
      expectInvariants(out);
      const expected =
        values.mode === 'density' ? values.density : values.mode === 'frequency' ? values.frequency : values.width;
      expect(out.correct).toBe(String(expected));
      // All three quantities are whole numbers however the question is asked.
      expect(Number.isInteger(values.frequency / values.width)).toBe(true);
    }
  });
});

/** The number inside a `123 unit` answer string. */
function numeric(text: string): number {
  return Number(text.replace(/[^\d.-]/g, ''));
}

/** No printed answer or distractor may be a repeating decimal (33.333333). */
function expectCleanNumbers(out: GeneratorOutput) {
  for (const text of [out.correct, ...out.distractors]) {
    const value = numeric(text);
    if (!Number.isFinite(value)) continue;
    expect(Math.abs(value * 1000 - Math.round(value * 1000))).toBeLessThan(1e-6);
  }
}

describe('phys-pressure', () => {
  const params: PressureParams = {
    modes: ['pressure', 'force', 'area', 'moment', 'hydraulic', 'lever'],
    forces: [50, 100, 200, 300, 500, 1000, 40, 80],
    areas: [0.01, 0.1, 0.25, 0.5, 2],
    distances: [0.2, 0.4, 0.5, 1, 1.5, 2],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-pressure'].generate(params, createRng('golden:phys-pressure'));
    expect(out).toEqual({
      stem: 'A force of 500 N acts on an area of 0.1 m². What is the pressure?',
      correct: '5000 Pa',
      distractors: ['50 Pa', '50000 Pa', '500 Pa'],
      explanation:
        'Pressure $= \\dfrac{F}{A} = \\dfrac{500\\text{ N}}{0.1\\text{ m}^2} = 5000\\text{ Pa}$. The 50 Pa option multiplies instead of dividing.',
    });
  });

  it('sweep: every answer is the formula applied to the drawn values', () => {
    for (let i = 0; i < 120; i++) {
      const rng = createRng(`sweep:phys-pressure:${i}`);
      const values = drawPressure(params, rng);
      const out = buildPressure(values, rng);
      expectInvariants(out);
      expectCleanNumbers(out);
      const expected: Record<string, number> = {
        pressure: values.f / values.a,
        force: values.f * values.a,
        area: values.answer,
        moment: values.f * values.d,
        hydraulic: (values.f * values.b) / values.a,
        lever: (values.f * values.d) / values.b,
      };
      expect(numeric(out.correct)).toBeCloseTo(expected[values.mode], 9);
    }
  });

  it('hydraulic answers are clean and lever answers are whole numbers', () => {
    for (let i = 0; i < 60; i++) {
      const lever = drawPressure({ ...params, modes: ['lever'] }, createRng(`lever:${i}`));
      expect(Number.isInteger(lever.answer)).toBe(true);
      const hydraulic = drawPressure({ ...params, modes: ['hydraulic'] }, createRng(`hyd:${i}`));
      expect(Math.abs(hydraulic.answer * 1000 - Math.round(hydraulic.answer * 1000))).toBeLessThan(1e-9);
    }
  });
});

describe('phys-density', () => {
  const params: DensityParams = {
    modes: ['density', 'mass', 'volume'],
    masses: [200, 540, 270, 1350, 1000],
    volumes: [50, 100, 200, 500],
    densities: [0.5, 1, 2, 2.7, 8, 10],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-density'].generate(params, createRng('golden:phys-density'));
    expect(out).toEqual({
      stem: 'An object has a mass of 270 g and a volume of 200 cm³. What is its density?',
      correct: '1.35 g/cm³',
      distractors: ['54000 g/cm³', '13.5 g/cm³', '0.135 g/cm³'],
      explanation:
        'Density $= \\dfrac{\\text{mass}}{\\text{volume}} = \\dfrac{270\\text{ g}}{200\\text{ cm}^3} = 1.35\\text{ g/cm}^3$. The 54000 g/cm³ option multiplies instead of dividing.',
    });
  });

  it('sweep: every answer is the formula applied to the drawn values', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:phys-density:${i}`);
      const values = drawDensity(params, rng);
      const out = buildDensity(values, rng);
      expectInvariants(out);
      expectCleanNumbers(out);
      const expected =
        values.mode === 'density' ? values.mass / values.volume : values.mode === 'mass' ? values.density * values.volume : values.mass / values.density;
      expect(numeric(out.correct)).toBeCloseTo(expected, 9);
    }
  });
});

describe('phys-wave-speed', () => {
  const params: WaveSpeedParams = {
    modes: ['speed', 'wavelength', 'frequency', 'period'],
    frequencies: [50, 100, 200, 250, 400, 500, 1000],
    wavelengths: [0.5, 1, 2, 2.5, 3, 4],
    periods: [0.02, 0.1, 0.2, 0.25, 0.5],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-wave-speed'].generate(params, createRng('golden:phys-wave-speed'));
    expect(out).toEqual({
      stem: 'A wave travels at 1600 m/s with a frequency of 400 Hz. What is its wavelength?',
      correct: '4 m',
      distractors: ['640000 m', '0.25 m', '40 m'],
      explanation:
        'Rearranged, wavelength $= \\dfrac{\\text{speed}}{\\text{frequency}} = \\dfrac{1600}{400} = 4\\text{ m}$. The 640000 m option multiplies instead of dividing.',
    });
  });

  it('sweep: every answer is the formula applied to the drawn values', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:phys-wave-speed:${i}`);
      const values = drawWaveSpeed(params, rng);
      const out = buildWaveSpeed(values, rng);
      expectInvariants(out);
      expectCleanNumbers(out);
      const expected =
        values.mode === 'speed'
          ? values.frequency * values.wavelength
          : values.mode === 'wavelength'
            ? values.wavelength
            : values.mode === 'frequency'
              ? 1 / values.period
              : 1 / values.frequency;
      expect(numeric(out.correct)).toBeCloseTo(expected, 9);
    }
  });

  it('round-trips frequency and period', () => {
    for (let i = 0; i < 40; i++) {
      const fromPeriod = drawWaveSpeed({ ...params, modes: ['frequency'] }, createRng(`f:${i}`));
      expect(fromPeriod.answer * fromPeriod.period).toBeCloseTo(1, 9);
      const fromFrequency = drawWaveSpeed({ ...params, modes: ['period'] }, createRng(`T:${i}`));
      expect(fromFrequency.answer * fromFrequency.frequency).toBeCloseTo(1, 9);
    }
  });
});

describe('phys-thermal-energy', () => {
  const params: ThermalEnergyParams = {
    modes: ['shc-energy', 'shc-mass', 'shc-temp-change', 'latent-energy', 'latent-mass'],
    masses: [0.5, 1, 2, 3, 5],
    shcs: [900, 4200, 390, 2100],
    deltas: [10, 20, 25, 30, 50],
    latents: [334000, 226000, 334, 226],
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['phys-thermal-energy'].generate(params, createRng('golden:phys-thermal-energy'));
    expect(out).toEqual({
      stem: 'Changing the state of a substance with a specific latent heat of 226 J/kg needs 452 J. What mass changes state?',
      correct: '2 kg',
      distractors: ['102152 kg', '1 kg', '20 kg'],
      explanation:
        'Rearranged, mass $= \\dfrac{E}{L} = \\dfrac{452}{226} = 2\\text{ kg}$. The 1 kg option halves the mass for no reason.',
    });
  });

  it('sweep: every answer is the formula applied to the drawn values', () => {
    for (let i = 0; i < 100; i++) {
      const rng = createRng(`sweep:phys-thermal:${i}`);
      const values = drawThermal(params, rng);
      const out = buildThermal(values, rng);
      expectInvariants(out);
      expectCleanNumbers(out);
      const energy = values.mode.startsWith('latent') ? values.mass * values.latent : values.mass * values.c * values.delta;
      const expected =
        values.mode === 'shc-energy' || values.mode === 'latent-energy'
          ? energy
          : values.mode === 'shc-mass'
            ? values.mass
            : values.mode === 'shc-temp-change'
              ? values.delta
              : energy / values.latent;
      expect(numeric(out.correct)).toBeCloseTo(expected, 9);
      // The stem must be about the quantity the answer is.
      if (values.mode === 'latent-mass') expect(out.stem).toMatch(/What mass changes state\?$/);
      if (values.mode === 'shc-temp-change') expect(out.stem).toMatch(/By how much does its temperature rise\?$/);
      if (values.mode === 'shc-mass') expect(out.stem).toMatch(/What mass is being heated\?$/);
    }
  });
});

describe('math-quadratic', () => {
  const params: QuadraticParams = {
    modes: ['solve-formula', 'discriminant', 'roots-count', 'complete-square', 'equation-from-roots'],
    roots: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    coefficients: [1, 2, 3],
    negatives: true,
  };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['math-quadratic'].generate(
      { modes: ['solve-formula'], roots: [3, 4], coefficients: [1], negatives: false },
      createRng('golden:math-quadratic')
    );
    expect(out).toEqual({
      stem: 'Solve $x^2 - 7x + 12 = 0$ using the quadratic formula.',
      correct: '$x = 3$ or $x = 4$',
      distractors: ['$x = -3$ or $x = -4$', '$x = -3$ or $x = 4$', '$x = 3$'],
      explanation:
        'Discriminant $= b^2 - 4ac = 49 - 48 = 1$, so $x = \\dfrac{7 \\pm \\sqrt{1}}{2}$, giving $x = 3$ and $x = 4$.',
    });
  });

  it('sweep: the constructed quadratic has exactly the roots it claims', () => {
    for (let i = 0; i < 150; i++) {
      const rng = createRng(`sweep:math-quadratic:${i}`);
      const values = drawQuadratic(params, rng);
      const out = buildQuadratic(values, rng);
      expectInvariants(out);
      // a x^2 + bx + c must equal a(x - r1)(x - r2) for the root-based modes.
      if (values.mode === 'solve-formula' || values.mode === 'equation-from-roots') {
        expect(values.b).toBe(-values.a * (values.r1 + values.r2));
        expect(values.c).toBe(values.a * values.r1 * values.r2);
        for (const root of [values.r1, values.r2]) {
          expect(values.a * root * root + values.b * root + values.c).toBe(0);
        }
      }
      if (values.mode === 'solve-formula') {
        const [low, high] = [values.r1, values.r2].sort((x, y) => x - y);
        expect(out.correct).toBe(`$x = ${low}$ or $x = ${high}$`);
      }
      if (values.mode === 'discriminant') {
        expect(Number(out.correct)).toBe(values.b * values.b - 4 * values.a * values.c);
        expect(out.stem.startsWith('What is the discriminant of $x^2')).toBe(true);
      }
      if (values.mode === 'roots-count') {
        const d = values.b * values.b - 4 * values.a * values.c;
        expect(out.correct).toBe(
          d > 0 ? 'Two distinct real roots' : d === 0 ? 'One repeated real root' : 'No real roots'
        );
      }
      if (values.mode === 'complete-square') {
        // (x + p)^2 + q must expand to x^2 + 2px + (p^2 + q).
        expect(values.b).toBe(2 * values.p);
        expect(values.c).toBe(values.p * values.p + values.q);
        if (values.q !== 0) expect(out.correct).toContain(`${values.q < 0 ? '-' : '+'} ${Math.abs(values.q)}`);
      }
    }
  });

  it('reaches all three discriminant signs, so roots-count is not a one-answer mode', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const values = drawQuadratic({ ...params, modes: ['roots-count'] }, createRng(`signs:${i}`));
      const d = values.b * values.b - 4 * values.a * values.c;
      seen.add(d > 0 ? 'positive' : d === 0 ? 'zero' : 'negative');
    }
    expect([...seen].sort()).toEqual(['negative', 'positive', 'zero']);
  });

  it('never prints a 1 coefficient or a double negative', () => {
    for (let i = 0; i < 150; i++) {
      const out = GENERATORS['math-quadratic'].generate(params, createRng(`render:${i}`));
      expect(out.stem).not.toMatch(/(^|[^0-9])1x/);
      expect(out.explanation).not.toMatch(/- -|\+ \+|--/);
    }
  });

  it('rejects a roots list whose values all coincide', () => {
    expect(GENERATORS['math-quadratic'].paramsSchema.safeParse({ roots: [5, 5] }).success).toBe(false);
    expect(GENERATORS['math-quadratic'].paramsSchema.safeParse({ roots: [5, 6] }).success).toBe(true);
  });
});

describe('flashcard-match', () => {
  // A vocabulary deck in the shape the language topics actually use.
  const deck = [
    { term: 'der Hund', definition: 'the dog' },
    { term: 'die Katze', definition: 'the cat' },
    { term: 'das Pferd', definition: 'the horse' },
    { term: 'der Vogel', definition: 'the bird' },
    { term: 'das Haus', definition: 'the house' },
    { term: 'die Schule', definition: 'the school' },
  ];
  const params: FlashcardMatchParams = { cards: deck, direction: ['term-to-definition', 'definition-to-term'], maxLength: 140 };

  it('golden output for a fixed seed', () => {
    const out = GENERATORS['flashcard-match'].generate(
      { cards: deck, direction: ['term-to-definition'], maxLength: 140 },
      createRng('golden:flashcard-match')
    );
    const terms = deck.map((card) => card.term);
    const definitions = deck.map((card) => card.definition);
    expect(terms.some((term) => out.stem.includes(term))).toBe(true);
    expect(definitions).toContain(out.correct);
    for (const distractor of out.distractors) expect(definitions).toContain(distractor);
    expect(out.explanation.length).toBeGreaterThanOrEqual(20);
  });

  it('sweep: the answer is the deck pairing, and the choices are 4 distinct deck entries', () => {
    for (let i = 0; i < 120; i++) {
      const rng = createRng(`sweep:flashcard-match:${i}`);
      const values = drawFlashcardMatch(params, rng);
      const out = buildFlashcardMatch(values, rng);
      expectInvariants(out);
      const choices = [out.correct, ...out.distractors];
      const pool = values.direction === 'term-to-definition' ? deck.map((c) => c.definition) : deck.map((c) => c.term);
      for (const choice of choices) expect(pool).toContain(choice);
      const expected = values.direction === 'term-to-definition' ? values.definition : values.term;
      expect(out.correct).toBe(expected);
      // The stem must ask about the correct card.
      expect(out.stem).toContain(values.direction === 'term-to-definition' ? values.term : values.definition);
    }
  });

  it('asks both directions, and a definition-to-term question never leaks the term as a distractor twice', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const values = drawFlashcardMatch(params, createRng(`dir:${i}`));
      seen.add(values.direction);
      const out = buildFlashcardMatch(values, createRng(`dir:${i}`));
      expect(new Set([out.correct, ...out.distractors]).size).toBe(4);
    }
    expect([...seen].sort()).toEqual(['definition-to-term', 'term-to-definition']);
  });

  it('drops choices longer than maxLength, and falls back to the shortest cards when none fit', () => {
    const longDeck = [
      { term: 'short-a', definition: 'a'.repeat(200) },
      { term: 'short-b', definition: 'b'.repeat(200) },
      { term: 'short-c', definition: 'c'.repeat(200) },
      { term: 'short-d', definition: 'd'.repeat(200) },
    ];
    // Nothing fits the cap, so the four shortest cards are used instead of throwing.
    for (let i = 0; i < 20; i++) {
      const out = GENERATORS['flashcard-match'].generate(
        { cards: longDeck, direction: ['term-to-definition'], maxLength: 60 },
        createRng(`long:${i}`)
      );
      expect(out.correct).not.toBe('');
      expect(longDeck.map((card) => card.definition)).toContain(out.correct);
    }
    const mixed = [...deck, { term: 'lang', definition: 'x'.repeat(150) }];
    for (let i = 0; i < 40; i++) {
      const out = GENERATORS['flashcard-match'].generate(
        { cards: mixed, direction: ['term-to-definition'], maxLength: 140 },
        createRng(`mix:${i}`)
      );
      expect(out.correct.length).toBeLessThanOrEqual(140);
      for (const distractor of out.distractors) expect(distractor.length).toBeLessThanOrEqual(140);
    }
  });

  it('rejects a deck with fewer than four cards', () => {
    expect(
      GENERATORS['flashcard-match'].paramsSchema.safeParse({ cards: deck.slice(0, 3), direction: ['term-to-definition'] }).success
    ).toBe(false);
    expect(
      GENERATORS['flashcard-match'].paramsSchema.safeParse({ cards: deck, direction: ['term-to-definition'] }).success
    ).toBe(true);
  });
});

// Schema defaults live on the schema, not on z.infer, so the tables are parsed.
const angleParams: AngleFactsParams = angleSchema.parse({
  angles: [35, 48, 62, 75, 90, 110, 130],
  polygons: [3, 4, 5, 6, 8, 9, 10, 12],
  exteriors: [15, 20, 24, 30, 36, 40, 45, 60, 72],
});

describe('math-angle-facts', () => {
  it('rejects an empty angle table', () => {
    expect(() => angleSchema.parse({ angles: [] })).toThrow();
  });

  it('sweep: the missing angle is what the angle fact leaves over', () => {
    sweep('math-angle-facts', angleParams, drawAngle, buildAngle, (v) => {
      const { mode, a, b, c, n, answer } = v;
      if (mode === 'straight-line' || mode === 'co-interior') expect(answer).toBe(180 - a);
      else if (mode === 'triangle') expect(answer).toBe(180 - a - b);
      else if (mode === 'quadrilateral' || mode === 'at-a-point') expect(answer).toBe(360 - a - b - c);
      else if (mode === 'isosceles-base') expect(answer).toBe((180 - a) / 2);
      else if (mode === 'polygon-interior-sum') expect(answer).toBe((n - 2) * 180);
      else if (mode === 'exterior-regular') expect(answer).toBe(360 / n);
      else if (mode === 'interior-regular') expect(answer).toBe(180 - 360 / n);
      else if (mode === 'sides-from-exterior') expect(answer).toBe(360 / a);
      // corresponding / alternate / vertically-opposite repeat the given angle
      return mode === 'sides-from-exterior' ? String(answer) : `$${answer}^{\\circ}$`;
    });
  });

  it('drops the per-angle polygon modes when no side count divides 360', () => {
    // 7 sides: only the interior-sum mode can answer in whole degrees.
    const params: AngleFactsParams = angleSchema.parse({
      modes: ['polygon-interior-sum', 'exterior-regular', 'interior-regular'],
      angles: [40, 60],
      polygons: [7],
    });
    for (let i = 0; i < 20; i++) {
      const out = GENERATORS['math-angle-facts'].generate(params, createRng(`poly7:${i}`));
      expect(out.stem).toContain('7 sides');
      expect(out.correct).toBe('$900^{\\circ}$');
    }
  });
});

const probabilityParams: ProbabilityParams = probabilitySchema.parse({
  counts: [2, 3, 4, 5, 6, 7, 8],
  totals: [10, 12, 15, 20, 25],
  trials: [40, 50, 60, 80, 100, 120],
});

describe('math-probability', () => {
  it('rejects a table where no count is smaller than a total', () => {
    expect(GENERATORS['math-probability'].paramsSchema.safeParse({ counts: [8, 9], totals: [5] }).success).toBe(false);
  });

  it('sweep: the answer is the probability, in lowest terms', () => {
    sweep('math-probability', probabilityParams, drawProbability, buildProbability, (v) => {
      const [p, q] = v.answer;
      if (v.mode === 'single') expect(p).toBe(v.r);
      else if (v.mode === 'complement') expect(p).toBe(v.n - v.r);
      else if (v.mode === 'or') expect(p).toBe(v.r + v.s);
      else if (v.mode === 'and-independent') expect(p).toBe(v.r * v.s);
      else if (v.mode === 'with-replacement') expect(p).toBe(v.r * v.r);
      else if (v.mode === 'without-replacement') expect(p).toBe(v.r * (v.r - 1));
      else expect(p).toBe((v.t * v.r) / v.n);
      const g = gcd(p, q);
      const num = p / g;
      const den = q / g;
      return den === 1 ? `$${num}$` : `$\\dfrac{${num}}{${den}}$`;
    });
  });

  it('never offers a distractor greater than 1', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-probability'].generate(probabilityParams, createRng(`p1:${i}`));
      for (const choice of [out.correct, ...out.distractors]) {
        const m = choice.match(/dfrac\{(\d+)\}\{(\d+)\}/);
        if (m) expect(Number(m[1])).toBeLessThanOrEqual(Number(m[2]));
      }
    }
  });
});

const pythagorasParams: PythagorasParams = pythagorasSchema.parse({});

describe('math-pythagoras-trig', () => {
  it('rejects a triple that is not right-angled', () => {
    expect(() => pythagorasSchema.parse({ triples: [[2, 3, 4]] })).toThrow();
  });

  it('sweep: the three sides really do satisfy a² + b² = c²', () => {
    sweep('math-pythagoras-trig', pythagorasParams, drawPythagoras, buildPythagoras, (v) => {
      if (v.mode === 'hypotenuse' || v.mode === 'distance') {
        expect(v.a * v.a + v.b * v.b).toBe(v.answer * v.answer);
        return v.mode === 'distance' ? String(v.answer) : `${v.answer} cm`;
      }
      if (v.mode === 'leg') {
        const known = v.given === 0 ? v.a : v.b;
        expect(known * known + v.answer * v.answer).toBe(v.c * v.c);
        return `${v.answer} cm`;
      }
      if (v.mode === 'trig-side') return `${v.answer} cm`;
      if (v.mode === 'trig-angle') return `$${v.answer}^{\\circ}$`;
      return `$${v.ratio}$`;
    });
  });

  it('never asks for a side at 45°, where the ratio is a surd', () => {
    const params: PythagorasParams = pythagorasSchema.parse({ modes: ['trig-side'] });
    for (let i = 0; i < 30; i++) {
      const out = GENERATORS['math-pythagoras-trig'].generate(params, createRng(`ts:${i}`));
      expect(out.stem).not.toMatch(/45\^/);
    }
  });
});

const calculusParams: CalculusParams = calculusSchema.parse({});

const evalPoly = (terms: Term[], x: number): number =>
  terms.reduce((total, t) => total + t.coef * x ** t.power, 0);

describe('math-calculus', () => {
  it('sweep: differentiating the printed curve reproduces the answer', () => {
    const h = 1e-5;
    sweep('math-calculus', calculusParams, drawCalculus, buildCalculus, (v) => {
      if (v.mode === 'gradient') {
        expect(v.answer).toBe(v.k * v.n * v.x ** (v.n - 1) + v.b);
        return `$${v.answer}$`;
      }
      if (v.mode === 'definite') {
        expect(v.answer).toBe(v.k * v.x ** (v.n + 1) + v.b * v.x ** 2);
        return `$${v.answer}$`;
      }
      if (v.mode === 'stationary') {
        expect(v.b).toBe(-2 * v.answer);
        return `$x = ${v.answer}$`;
      }
      if (v.mode === 'differentiate') {
        const curve: Term[] = [
          { coef: v.k, power: v.n },
          { coef: v.b, power: 1 },
          { coef: v.c, power: 0 },
        ];
        const numeric = (evalPoly(curve, 2 + h) - evalPoly(curve, 2)) / h;
        expect(numeric).toBeCloseTo(v.k * v.n * 2 ** (v.n - 1) + v.b, 2);
        return `$${poly([{ coef: v.k * v.n, power: v.n - 1 }, { coef: v.b, power: 1 }])}$`;
      }
      // integrate: the printed antiderivative must differentiate back to the integrand
      const integrand: Term[] = [
        { coef: (v.n + 1) * v.k, power: v.n },
        { coef: 2 * v.b, power: 1 },
        { coef: v.c, power: 0 },
      ];
      const anti: Term[] = [
        { coef: v.k, power: v.n + 1 },
        { coef: v.b, power: 2 },
        { coef: v.c, power: 1 },
      ];
      expect((evalPoly(anti, 2 + h) - evalPoly(anti, 2)) / h).toBeCloseTo(evalPoly(integrand, 2), 2);
      return `$${poly(anti)} + C$`;
    });
  });

  it('never prints a fractional coefficient in the integrate mode', () => {
    const params: CalculusParams = calculusSchema.parse({ modes: ['integrate'] });
    for (let i = 0; i < 30; i++) {
      const out = GENERATORS['math-calculus'].generate(params, createRng(`int:${i}`));
      for (const choice of [out.correct, ...out.distractors]) expect(choice).not.toMatch(/frac/);
    }
  });
});

const vectorsParams: VectorsParams = vectorsSchema.parse({});

const colT = (parts: (number | string)[]): string => `$\\begin{pmatrix} ${parts.join(' \\\\ ')} \\end{pmatrix}$`;

describe('math-vectors', () => {
  it('rejects a 3-D quadruple that is not Pythagorean', () => {
    expect(() => vectorsSchema.parse({ solids: [[1, 1, 1, 2]] })).toThrow();
  });

  it('sweep: the answer is the vector arithmetic the mode names', () => {
    sweep('math-vectors', vectorsParams, drawVectors, buildVectors, (v) => {
      const { mode, a, b, k, dim, answer } = v;
      if (mode === 'add') return colT([a[0] + b[0], a[1] + b[1]]);
      if (mode === 'subtract') return colT([a[0] - b[0], a[1] - b[1]]);
      if (mode === 'scale') return colT([a[0] * k, a[1] * k]);
      if (mode === 'magnitude') {
        const parts = dim === 2 ? [a[0], a[1]] : [a[0], a[1], a[2]];
        expect(answer * answer).toBe(parts.reduce((t, p) => t + p * p, 0));
        return `$${answer}$`;
      }
      if (mode === 'dot') {
        const parts = dim === 2 ? [a[0], a[1]] : [a[0], a[1], a[2]];
        const others = dim === 2 ? [b[0], b[1]] : [b[0], b[1], b[2]];
        expect(answer).toBe(parts.reduce((t, p, i) => t + p * others[i], 0));
        return `$${answer}$`;
      }
      if (mode === 'midpoint') {
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const toA = (mid[0] - a[0]) ** 2 + (mid[1] - a[1]) ** 2;
        const toB = (mid[0] - b[0]) ** 2 + (mid[1] - b[1]) ** 2;
        expect(toA).toBe(toB);
        return colT(mid);
      }
      if (mode === 'unit') {
        expect(a[0] * a[0] + a[1] * a[1]).toBe(answer * answer);
        const show = (num: number): string => {
          const g = gcd(Math.abs(num), answer);
          const q = answer / g;
          return q === 1 ? String(num / g) : `\\dfrac{${num / g}}{${q}}`;
        };
        return colT([show(a[0]), show(a[1])]);
      }
      // perp-k: the completed pair really is perpendicular
      expect(a[0] * b[0] + a[1] * k).toBe(0);
      return `$k = ${k}$`;
    });
  });

  it('never asks for the midpoint of a symmetric pair (that midpoint is the origin)', () => {
    const params: VectorsParams = vectorsSchema.parse({ modes: ['midpoint'] });
    for (let i = 0; i < 40; i++) {
      const out = GENERATORS['math-vectors'].generate(params, createRng(`mid:${i}`));
      expect(out.correct).not.toBe(colT([0, 0]));
    }
  });
});

const straightLineParams: StraightLineParams = straightLineSchema.parse({
  gradients: [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6],
  intercepts: [-7, -5, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7],
  xs: [1, 2, 3, 4, 5, 6],
});

/** Read a printed gradient back as a number — the sweep's independent half of the
 *  perpendicular check (the generator's own formatter is not allowed to grade itself). */
const printedGradient = (choice: string): number => {
  if (choice === '$-1$') return -1;
  if (choice === '$1$') return 1;
  const parts = [...choice.matchAll(/\{(\d+)\}/g)];
  const magnitude = Number(parts[parts.length - 1]?.[1]);
  return choice.startsWith('$-\\dfrac') ? -1 / magnitude : 1 / magnitude;
};

describe('math-straight-line', () => {
  it('rejects a zero gradient (a zero gradient is a horizontal line, not y = mx + c)', () => {
    expect(straightLineSchema.safeParse({ gradients: [0], intercepts: [1], xs: [1, 2] }).success).toBe(false);
  });

  it('sweep: every answer is the straight-line fact the question asks for', () => {
    sweep('math-straight-line', straightLineParams, drawStraightLine, buildStraightLine, (v) => {
      if (v.mode === 'gradient-from-two-points') {
        expect((v.y2 - v.y1) / (v.x2 - v.x1)).toBe(v.answerValue);
        return `$${v.m}$`;
      }
      if (v.mode === 'y-intercept') return `$${v.c}$`;
      if (v.mode === 'equation-from-gradient-and-intercept') return line(v.m, v.c);
      if (v.mode === 'x-intercept') {
        expect(v.m * v.answerValue + v.c).toBe(0);
        return `$${fmtNumber(v.answerValue)}$`;
      }
      if (v.mode === 'parallel-through-point') {
        const b = v.y1 - v.m * v.x1;
        return line(v.m, b);
      }
      if (v.mode === 'perpendicular-gradient') {
        expect(v.m * printedGradient(v.answer)).toBe(-1);
        return negativeReciprocal(v.m);
      }
      if (v.mode === 'horizontal-line') return `$y = ${fmtNumber(v.y1)}$`;
      if (v.mode === 'missing-coordinate') {
        expect((v.y2 - v.answerValue) / (v.x2 - v.x1)).toBe(v.m);
        return `$${fmtNumber(v.answerValue)}$`;
      }
      if (v.mode === 'point-on-line') {
        expect(v.answerValue).toBeNaN();
        expect(v.y1).toBe(v.m * v.x1 + v.c);
        return `$(${fmtNumber(v.x1)}, ${fmtNumber(v.m * v.x1 + v.c)})$`;
      }
      return `$C = ${fmtNumber(v.rate)}h + ${fmtNumber(v.fee)}$`;
    });
  });

  it('still offers three distinct distractors from a one-entry param table', () => {
    // The regression for uniqueDistractors: the form-answer modes have a fixed candidate
    // list, so a tiny table used to run out and throw mid-session.
    const params: StraightLineParams = straightLineSchema.parse({ gradients: [1], intercepts: [1], xs: [1, 2] });
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-straight-line'].generate(params, createRng(`tiny:${i}`));
      expect(new Set([out.correct, ...out.distractors]).size).toBe(4);
    }
  });

  it('drops the x-intercept mode when no intercept is divisible by the gradient', () => {
    const params: StraightLineParams = straightLineSchema.parse({
      modes: ['x-intercept'],
      gradients: [3],
      intercepts: [4, 5, 7],
      xs: [1, 2],
    });
    expect(() => drawStraightLine(params, createRng('xi:0'))).toThrow(/no mode is feasible/);
  });
});

const binomialParams: BinomialParams = binomialSchema.parse({ ns: [3, 4, 5, 6, 7, 8], cs: [2, 3, 4, 5], ks: [2, 3, 4], rs: [1, 2, 3, 4, 5] });

describe('math-binomial', () => {
  it('computes nCr from factorials independently of the generator', () => {
    expect(choose(6, 3)).toBe(20);
    expect(choose(10, 8)).toBe(45);
    expect(choose(5, 0)).toBe(1);
    expect(pascalRow(4)).toBe('1, 4, 6, 4, 1');
  });

  it('sweep: every coefficient is recomputed from factorials', () => {
    const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));
    const nCr = (n: number, r: number): number => Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
    sweep('math-binomial', binomialParams, drawBinomial, buildBinomial, (v) => {
      if (v.mode === 'ncr') {
        expect(v.answerValue).toBe(nCr(v.n, v.r));
        return `$${fmtNumber(v.answerValue)}$`;
      }
      if (v.mode === 'term-count') return `$${fmtNumber(v.n + 1)}$`;
      if (v.mode === 'coefficient-x-plus-c') {
        expect(v.answerValue).toBe(nCr(v.n, v.r) * v.k ** (v.n - v.r));
        return `$${fmtNumber(v.answerValue)}$`;
      }
      if (v.mode === 'coefficient-1-plus-kx') {
        expect(v.answerValue).toBe(nCr(v.n, v.r) * v.k ** v.r);
        return `$${fmtNumber(v.answerValue)}$`;
      }
      if (v.mode === 'coefficient-2x-plus-1') {
        expect(v.answerValue).toBe(nCr(v.n, v.r) * 2 ** v.r);
        return `$${fmtNumber(v.answerValue)}$`;
      }
      if (v.mode === 'pascal-row') {
        const row = Array.from({ length: v.n + 1 }, (_, r) => nCr(v.n, r)).join(', ');
        expect(v.answer).toBe(row);
        return row;
      }
      if (v.mode === 'constant-term') {
        const t = v.n / 2;
        expect(nCr(v.n, t) * v.k ** t).toBe(v.answerValue);
        return `$${fmtNumber(v.answerValue)}$`;
      }
      // sum-of-coefficients: (kx + 1)^n at x = 1
      let sum = 0;
      for (let r = 0; r <= v.n; r++) sum += nCr(v.n, r) * v.k ** r;
      expect(v.answerValue).toBe(sum);
      return `$${fmtNumber(sum)}$`;
    });
  });

  it('never prints a fractional coefficient', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-binomial'].generate(binomialParams, createRng(`int:${i}`));
      for (const choice of [out.correct, ...out.distractors]) expect(choice).not.toMatch(/dfrac|\.\d/);
    }
  });
});

const decimalParams: DecimalArithmeticParams = decimalSchema.parse({
  hundredths: [246, 380, 437, 185, 245, 560, 700, 1250, 2405],
  thousandths: [58, 34, 6246, 4500, 750, 125],
  powers: [10, 100, 1000],
  products: [
    [6, 15],
    [4, 25],
    [8, 5],
    [3, 12],
  ],
  quotients: [
    [560, 7],
    [450, 9],
    [1260, 6],
    [84, 4],
  ],
  fractions: [
    [7, 20],
    [3, 8],
    [9, 25],
    [13, 50],
  ],
});

describe('math-decimal-arithmetic', () => {
  it('drops the quotient mode when the decimal would not terminate', () => {
    const params: DecimalArithmeticParams = decimalSchema.parse({
      ...decimalParams,
      modes: ['quotient'],
      quotients: [[100, 3]],
    });
    expect(() => drawDecimal(params, createRng('q:0'))).toThrow(/no mode is feasible/);
  });

  it('sweep: the answer is recomputed from the scaled integers', () => {
    sweep('math-decimal-arithmetic', decimalParams, drawDecimal, buildDecimal, (v) => {
      if (v.mode === 'add') return fmtNumber((v.a + v.b) / 100);
      if (v.mode === 'subtract') return fmtNumber((v.a - v.b) / 100);
      if (v.mode === 'multiply-decimal-by-power') return fmtNumber((v.a * v.p) / 1000);
      if (v.mode === 'divide-integer-by-power') return fmtNumber(v.a / v.p);
      if (v.mode === 'product') return fmtNumber((v.a * v.b) / 1000);
      if (v.mode === 'quotient') return fmtNumber(v.a / (10 * v.b));
      if (v.mode === 'fraction-to-decimal') return fmtNumber(v.a / v.b);
      return `£${fmtNumber(10 - (v.a + v.b) / 100)}`;
    });
  });

  it('never offers a negative quantity of change', () => {
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-decimal-arithmetic'].generate(decimalParams, createRng(`change:${i}`));
      if (out.stem.includes('change')) expect(Number(out.correct.replace('£', ''))).toBeGreaterThan(0);
    }
  });
});

const integerParams: IntegerOperationsParams = integerSchema.parse({
  addends: [5748, 5236, 3748, 6205, 2478, 875, 672, 64, 15, 24],
  factorsA: [34, 26, 64, 47],
  factorsB: [7, 8, 9, 6],
  divisors: [5, 16, 7, 12],
  quotients: [175, 42, 86, 24],
  bidmas: [
    [5, 3, 6],
    [8, 4, 3],
    [12, 5, 6],
  ],
  brackets: [
    [8, 4, 3, 5],
    [6, 5, 4, 9],
    [12, 3, 5, 7],
  ],
  powers: [
    [3, 2, 3, 4],
    [5, 3, 3, 2],
    [7, 2, 4, 3],
  ],
});

describe('math-integer-operations', () => {
  it('sweep: every answer follows the printed numbers and the order of operations', () => {
    sweep('math-integer-operations', integerParams, drawInteger, buildInteger, (v) => {
      if (v.mode === 'place-value') {
        const digit = Math.floor(v.a / v.place) % 10;
        expect(v.answerValue).toBe(digit * v.place);
        return `$${fmtNumber(digit * v.place)}$`;
      }
      if (v.mode === 'add') return `$${fmtNumber(v.a + v.b)}$`;
      if (v.mode === 'subtract') {
        expect(v.a).toBeGreaterThan(v.b);
        return `$${fmtNumber(v.a - v.b)}$`;
      }
      if (v.mode === 'multiply') return `$${fmtNumber(v.a * v.b)}$`;
      if (v.mode === 'divide') {
        expect(v.a).toBe(v.b * v.answerValue);
        return `$${fmtNumber(v.a / v.b)}$`;
      }
      if (v.mode === 'bidmas') {
        expect(v.answerValue).toBe(v.a + v.b * v.c);
        expect(v.answerValue).not.toBe((v.a + v.b) * v.c);
        return `$${fmtNumber(v.a + v.b * v.c)}$`;
      }
      if (v.mode === 'brackets') return `$${fmtNumber((v.a + v.b) * v.c - v.d)}$`;
      expect(v.answerValue).toBe(v.a + v.b ** v.d * v.c);
      return `$${fmtNumber(v.a + v.b ** v.d * v.c)}$`;
    });
  });

  it('keeps the place-value answer an integer, never a fraction of a place', () => {
    for (let i = 0; i < 80; i++) {
      const out = GENERATORS['math-integer-operations'].generate(integerParams, createRng(`pv:${i}`));
      if (out.stem.startsWith('What is the value of the digit')) {
        for (const choice of [out.correct, ...out.distractors]) expect(choice).toMatch(/^\$\d+\$$/);
      }
    }
  });
});

const numberBasesParams: NumberBasesParams = numberBasesSchema.parse({
  binaries: ['1011', '11010', '101101', '1000000', '11001', '110010'],
  decimals: [25, 50, 77, 11, 26, 45],
  bits: [2, 3, 4, 5, 6, 8, 10],
  hexDigits: ['A', 'B', 'C', 'D', 'E', 'F'],
});

describe('math-number-bases', () => {
  it('rejects a "binary" string that is not binary', () => {
    expect(numberBasesSchema.safeParse({ binaries: ['1201'], decimals: [1, 2] }).success).toBe(false);
  });

  it('sweep: every answer is the engine-level conversion, not a table lookup', () => {
    sweep('math-number-bases', numberBasesParams, drawNumberBases, buildNumberBases, (v) => {
      if (v.mode === 'binary-to-decimal') {
        expect(v.answerValue).toBe(Number.parseInt(v.binary, 2));
        return `$${Number.parseInt(v.binary, 2)}$`;
      }
      if (v.mode === 'decimal-to-binary') {
        return `$${v.decimal.toString(2)}_2$`;
      }
      if (v.mode === 'place-value') {
        expect(v.answerValue).toBe(2 ** (v.exponent + 1));
        return `$${2 ** (v.exponent + 1)}$`;
      }
      if (v.mode === 'max-with-bits') {
        expect(v.answerValue).toBe(2 ** v.exponent - 1);
        return `$${2 ** v.exponent - 1}$`;
      }
      if (v.mode === 'hex-digit-value') {
        expect(v.answerValue).toBe(Number.parseInt(v.hex, 16));
        return `$${Number.parseInt(v.hex, 16)}$`;
      }
      // hex-to-binary: the printed four bits must parse back to the digit
      expect(Number.parseInt(v.binary, 2)).toBe(Number.parseInt(v.hex, 16));
      expect(v.binary).toHaveLength(4);
      return `$${Number.parseInt(v.hex, 16).toString(2).padStart(4, '0')}_2$`;
    });
  });
});

const factorsParams: FactorsMultiplesParams = factorsSchema.parse({
  composites: [48, 60, 72, 100, 36, 90, 84, 126, 20, 42],
  pairs: [
    [18, 30],
    [6, 10],
    [36, 60],
    [12, 18],
    [24, 30],
    [8, 12],
  ],
  multiples: [8, 6, 7, 9, 12],
  bounds: [50, 40, 100, 30, 25],
  numbers: [21, 35, 49, 51, 77, 121, 39],
  squares: [144, 81, 100, 49, 36, 64],
});

describe('math-factors-multiples', () => {
  const isPrime = (n: number): boolean => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  const factorCount = (n: number): number => {
    let count = 0;
    for (let d = 1; d <= n; d++) if (n % d === 0) count++;
    return count;
  };
  const maxCommonDivisor = (a: number, b: number): number => {
    let best = 1;
    for (let d = 2; d <= Math.min(a, b); d++) if (a % d === 0 && b % d === 0) best = d;
    return best;
  };
  const firstCommonMultiple = (a: number, b: number): number => {
    for (let k = Math.max(a, b); ; k++) if (k % a === 0 && k % b === 0) return k;
  };

  it('sweep: factorisations multiply back, lists are complete, HCF/LCM are recomputed', () => {
    sweep('math-factors-multiples', factorsParams, drawFactors, buildFactors, (v) => {
      if (v.mode === 'prime-factorisation') {
        // Independent check: parse the printed product back and require it to equal n with
        // every base prime. A missing or extra prime cannot survive this.
        const terms = v.answer.replace(/\$/g, '').split(' \\times ');
        let product = 1;
        for (const term of terms) {
          const power = /^(\d+)\^\{(\d+)\}$/.exec(term);
          const [base, exponent] = power ? [Number(power[1]), Number(power[2])] : [Number(term), 1];
          expect(isPrime(base)).toBe(true);
          product *= base ** exponent;
        }
        expect(product).toBe(v.n);
        return v.answer;
      }
      if (v.mode === 'factors-list') {
        const list = v.answer.split(', ').map(Number);
        expect(list).toEqual([...list].sort((a, b) => a - b));
        expect(new Set(list).size).toBe(list.length);
        for (const factor of list) expect(v.n % factor).toBe(0);
        expect(list.length).toBe(factorCount(v.n));
        return v.answer;
      }
      if (v.mode === 'hcf') {
        expect(v.answerValue).toBe(maxCommonDivisor(v.a, v.b));
        return `$${v.answerValue}$`;
      }
      if (v.mode === 'lcm') {
        expect(v.answerValue).toBe(firstCommonMultiple(v.a, v.b));
        return `$${v.answerValue}$`;
      }
      if (v.mode === 'first-multiple-above') {
        expect(v.answerValue % v.multiple).toBe(0);
        expect(v.answerValue).toBeGreaterThan(v.bound);
        expect(v.answerValue - v.multiple).toBeLessThanOrEqual(v.bound);
        return `$${v.answerValue}$`;
      }
      if (v.mode === 'smallest-prime-factor') {
        let spf = v.n;
        for (let p = 2; p <= v.n; p++) if (v.n % p === 0 && isPrime(p)) { spf = p; break; }
        expect(v.answerValue).toBe(spf);
        return `$${v.answerValue}$`;
      }
      expect(v.answerValue * v.answerValue).toBe(v.n);
      return `$${v.answerValue}$`;
    });
  });

  it('never prints a fractional distractor in the integer modes', () => {
    for (let i = 0; i < 80; i++) {
      const out = GENERATORS['math-factors-multiples'].generate(factorsParams, createRng(`int:${i}`));
      if (out.stem.startsWith('What is the prime factorisation') || out.stem.startsWith('Which list shows')) continue;
      for (const choice of [out.correct, ...out.distractors]) expect(choice).toMatch(/^\$\d+\$$/);
    }
  });
});

const directedParams: DirectedNumbersParams = directedSchema.parse({
  values: [2, 3, 4, 5, 6, 8, 9, 12, 20, 36],
  bidmas: [
    [2, 3, 4],
    [5, 4, 3],
    [10, 2, 6],
  ],
  temperatures: [8, 12, 15],
  rises: [13, 17, 20],
  depths: [45, 60, 30],
  dives: [28, 15, 40],
});

describe('math-directed-numbers', () => {
  it('sweep: the printed expression and the answer always agree in sign', () => {
    sweep('math-directed-numbers', directedParams, drawDirected, buildDirected, (v) => {
      const degC = (n: number): string => `$${fmtNumber(n)}^\\circ\\text{C}$`;
      if (v.mode === 'add') {
        expect(v.answerValue).toBe(v.a + v.b);
        return `$${fmtNumber(v.a + v.b)}$`;
      }
      if (v.mode === 'subtract') {
        expect(v.answerValue).toBe(v.a - v.b);
        return `$${fmtNumber(v.a - v.b)}$`;
      }
      if (v.mode === 'multiply') {
        expect(v.answerValue).toBe(v.a * v.b);
        return `$${fmtNumber(v.a * v.b)}$`;
      }
      if (v.mode === 'divide') {
        expect(v.answerValue).toBe(v.a / v.b);
        expect(Number.isInteger(v.answerValue)).toBe(true);
        return `$${fmtNumber(v.a / v.b)}$`;
      }
      if (v.mode === 'bidmas') {
        expect(v.answerValue).toBe(v.a + v.b * v.c);
        expect(v.b).toBeLessThan(0);
        return `$${fmtNumber(v.a + v.b * v.c)}$`;
      }
      if (v.mode === 'temperature') {
        expect(v.answerValue).toBe(v.a + v.b);
        return degC(v.a + v.b);
      }
      expect(v.answerValue).toBe(v.a + v.b);
      return `$${fmtNumber(v.a + v.b)}$ metres`;
    });
  });

  it('always divides exactly, so no answer is a recurring decimal', () => {
    const params: DirectedNumbersParams = { ...directedParams, modes: ['divide'] };
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-directed-numbers'].generate(params, createRng(`div:${i}`));
      for (const choice of [out.correct, ...out.distractors]) {
        // Math.abs: JS gives -0 for `-6 % 1`, and Object.is distinguishes it from 0.
        expect(Math.abs(Number(choice.replace(/[^\d.-]/g, '')) % 1)).toBe(0);
      }
    }
  });
});

const ratioParams: RatioParams = ratioSchema.parse({
  ratios: [
    [3, 4],
    [2, 5],
    [5, 6],
    [7, 3],
    [4, 5],
    [72, 90],
    [6, 10],
  ],
  amounts: [168, 180, 240, 360],
  unitCases: [
    [9, 54],
    [4, 24],
    [6, 42],
    [5, 35],
  ],
  quantities: [13, 9, 7, 11],
  directCases: [
    [8, 28, 14],
    [5, 20, 9],
    [4, 18, 10],
  ],
  inverseCases: [
    [5, 16, 10],
    [6, 12, 4],
    [8, 4, 16],
  ],
  scales: [40000, 25000, 50000, 100000],
  mapLengths: [6, 4, 8, 3],
  factors: [3, 4, 5, 6, 7, 9],
});

/** "£72 and £96" -> [72, 96]. */
const parseShares = (text: string): number[] =>
  text.replace(/[£$]/g, '').split(' and ').map(Number);

describe('math-ratio', () => {
  it('sweep: every answer satisfies its defining relation', () => {
    sweep('math-ratio', ratioParams, drawRatio, buildRatio, (v) => {
      if (v.mode === 'simplify') {
        const g = gcd(v.a, v.b);
        expect(g).toBeGreaterThan(1); // only ratios worth simplifying are drawn
        return `$${fmtNumber(v.a / g)}:${fmtNumber(v.b / g)}$`;
      }
      if (v.mode === 'share') {
        const [first, second] = parseShares(v.answer);
        expect(first + second).toBe(v.amount);
        expect(first / second).toBeCloseTo(v.a / v.b, 10);
        return v.answer;
      }
      if (v.mode === 'unitary') {
        expect(v.totalCost % v.count).toBe(0);
        const unit = v.totalCost / v.count;
        expect(v.answerValue).toBe(unit * v.quantity);
        return `£$${fmtNumber(unit * v.quantity)}$`;
      }
      if (v.mode === 'direct-proportion') {
        // both pairs must share the same constant k
        expect(v.answerValue / v.x2).toBeCloseTo(v.y1 / v.x1, 10);
        return `$${fmtNumber((v.y1 / v.x1) * v.x2)}$`;
      }
      if (v.mode === 'inverse-proportion') {
        // the product must be constant
        expect(v.answerValue * v.x2).toBeCloseTo(v.x1 * v.y1, 10);
        return `$${fmtNumber((v.x1 * v.y1) / v.x2)}$`;
      }
      if (v.mode === 'map-scale') {
        expect(v.answerValue * 100000).toBe(v.cm * v.scale);
        return `$${fmtNumber((v.cm * v.scale) / 100000)}$ km`;
      }
      if (v.mode === 'missing-part') {
        const onePart = v.amount / v.a;
        expect(onePart).toBe(v.k);
        expect(v.answerValue).toBe(v.b * v.k);
        return `$${fmtNumber(v.b * v.k)}$`;
      }
      // difference: the two numbers are a·k and b·k and their difference is amount
      const larger = Math.max(v.a, v.b) * v.k;
      expect(larger - Math.min(v.a, v.b) * v.k).toBe(v.amount);
      return `$${fmtNumber(larger)}$`;
    });
  });

  it('never shares an amount the ratio does not divide exactly', () => {
    const params: RatioParams = { ...ratioParams, modes: ['share'] };
    for (let i = 0; i < 60; i++) {
      const out = GENERATORS['math-ratio'].generate(params, createRng(`share:${i}`));
      const [first, second] = parseShares(out.correct);
      expect(Number.isInteger(first)).toBe(true);
      expect(Number.isInteger(second)).toBe(true);
    }
  });
});

const measuresParams: MeasuresParams = measuresSchema.parse({
  kgs: [2.3, 4.5, 1.2, 0.75, 2.25, 0.9],
  metres: [4500, 2500, 1250, 8000],
  cms: [5, 8, 12, 25],
  squareMetres: [2, 3, 5],
  cubicCms: [5000, 2500, 3000, 750],
  hours: [3, 4, 5],
  minutes: [140, 205, 95, 75],
  tanks: [
    [20, 15, 10],
    [40, 25, 10],
    [30, 20, 15],
  ],
  miles: [10, 15, 5, 3],
});

describe('math-measures', () => {
  it('sweep: the conversion factor and the unit are both right', () => {
    sweep('math-measures', measuresParams, drawMeasures, buildMeasures, (v) => {
      const n = v.answerValue;
      if (v.mode === 'kg-to-g') {
        expect(n).toBe((n / 1000) * 1000);
        expect(Number.isInteger(n)).toBe(true);
        return `$${fmtNumber(n)}$ g`;
      }
      if (v.mode === 'm-to-km') {
        expect(Number.isInteger(n * 1000)).toBe(true);
        return `$${fmtNumber(n)}$ km`;
      }
      if (v.mode === 'cm-to-mm') {
        expect(n % 10).toBe(0);
        return `$${fmtNumber(n)}$ mm`;
      }
      if (v.mode === 'm2-to-cm2') {
        expect(n % 10000).toBe(0);
        return `$${fmtNumber(n)}$ cm²`;
      }
      if (v.mode === 'cm3-to-litres') {
        expect(n * 1000).toBe(Math.round(n * 1000));
        return `$${fmtNumber(n)}$ l`;
      }
      if (v.mode === 'hours-to-minutes') {
        expect(n % 60).toBe(0);
        return `$${fmtNumber(n)}$ min`;
      }
      if (v.mode === 'minutes-to-hours-minutes') {
        expect(v.b * 60 + v.c).toBe(v.value);
        expect(v.c).toBeLessThan(60);
        return `$${fmtNumber(v.b)}$ hours $${fmtNumber(v.c)}$ minutes`;
      }
      if (v.mode === 'tank-litres') {
        // v.value/b/c are the dimensions in cm; the litres must be their product / 1000
        expect(n * 1000).toBe(v.value * v.b * v.c);
        return `$${fmtNumber(n)}$ l`;
      }
      if (v.mode === 'miles-to-km') {
        expect(n).toBeCloseTo((n / 1.6) * 1.6, 10);
        return `$${fmtNumber(n)}$ km`;
      }
      expect(n * 0.45).toBeCloseTo(n * 0.45, 10);
      return `$${fmtNumber(n)}$ lb`;
    });
  });

  it('never converts an area by 100 (the dimensions both change)', () => {
    const params: MeasuresParams = { ...measuresParams, modes: ['m2-to-cm2'] };
    for (let i = 0; i < 40; i++) {
      const out = GENERATORS['math-measures'].generate(params, createRng(`area:${i}`));
      expect(out.correct).toMatch(/^\$\d+\$ cm²$/);
      for (const choice of out.distractors) expect(choice).not.toBe(out.correct);
    }
  });
});

const circleParams: CircleTheoremsParams = circleSchema.parse({
  angles: [20, 25, 30, 35, 40, 42, 45, 50, 55, 58, 60, 65, 70, 75, 80],
  tangentAngles: [20, 30, 40, 50, 60, 70, 80],
  lengths: [5, 6, 7, 9, 12, 14],
});

describe('math-circle-theorems', () => {
  it('sweep: every theorem mode reproduces its own rule', () => {
    sweep('math-circle-theorems', circleParams, drawCircle, buildCircle, (v) => {
      const d = (n: number): string => `$${fmtNumber(n)}^{\\circ}$`;
      if (v.mode === 'angle-at-centre') {
        expect(v.answerValue).toBe(2 * v.a);
        return d(2 * v.a);
      }
      if (v.mode === 'angle-at-circumference') {
        // v.a is the CENTRAL angle (twice the inscribed one), so halving must be exact
        expect(v.a % 2).toBe(0);
        expect(v.answerValue).toBe(v.a / 2);
        return d(v.a / 2);
      }
      if (v.mode === 'minor-arc') {
        expect(v.answerValue).toBe(180 - v.a / 2);
        return d(180 - v.a / 2);
      }
      if (v.mode === 'same-segment' || v.mode === 'alternate-segment') {
        expect(v.answerValue).toBe(v.a);
        return d(v.a);
      }
      if (v.mode === 'cyclic-quadrilateral') {
        expect(v.answerValue).toBe(180 - v.a);
        return d(180 - v.a);
      }
      if (v.mode === 'semicircle') {
        expect(v.a).toBeLessThan(90);
        expect(v.answerValue).toBe(90 - v.a);
        return d(90 - v.a);
      }
      if (v.mode === 'tangent-radius') {
        expect(v.answerValue).toBe(90);
        return d(90);
      }
      if (v.mode === 'two-tangents-length') {
        expect(v.answerValue).toBe(v.length);
        return `$${fmtNumber(v.length)}$ cm`;
      }
      // two-tangents-angle: isosceles, so the base angle is (180 - t)/2 and t must be even
      expect(v.tangent % 2).toBe(0);
      expect(v.answerValue).toBe((180 - v.tangent) / 2);
      return d((180 - v.tangent) / 2);
    });
  });

  it('keeps every angle a whole number of degrees', () => {
    for (let i = 0; i < 80; i++) {
      const out = GENERATORS['math-circle-theorems'].generate(circleParams, createRng(`whole:${i}`));
      for (const choice of [out.correct, ...out.distractors]) {
        const value = Number(/^\$(\d+)/.exec(choice)?.[1]);
        if (out.correct.includes('cm')) continue;
        expect(Number.isInteger(value), choice).toBe(true);
      }
    }
  });
});

const trigRulesParams: TrigRulesParams = trigRulesSchema.parse({
  sineSideCases: [
    [30, 90, 6],
    [30, 30, 5],
    [45, 45, 7],
    [30, 60, 4],
    [45, 90, 3],
    [90, 30, 8],
  ],
  sineAngleCases: [
    [30, 6, 12],
    [30, 6, 6],
    [45, 5, 5],
    [90, 10, 5],
    [30, 8, 8],
  ],
  cosineSideCases: [
    [5, 8, 60],
    [6, 6, 60],
    [7, 15, 60],
    [6, 10, 120],
    [3, 5, 120],
    [8, 8, 60],
    [4, 4, 120],
  ],
  cosineAngleCases: [
    [7, 5, 3],
    [5, 4, 3],
    [8, 5, 7],
    [3, 3, 3],
    [6, 10, 14],
    [5, 5, 5],
  ],
  areaCases: [
    [8, 10, 30],
    [6, 10, 120],
    [4, 5, 90],
    [8, 8, 60],
    [6, 10, 30],
    [5, 5, 45],
    [8, 6, 60],
  ],
});

/** Read a printed exact quantity back as a number: "16\sqrt{3}" -> 27.71…, "\sqrt{2}" -> 1.41… */
const exactNumber = (choice: string): number => {
  const body = choice
    .replace(/\$/g, '')
    .replace(/\\text\{[^}]*\}/g, '')
    .replace(/\^2/g, '')
    .replace(/\s*(cm|cm²|cm\^2)\s*/g, '')
    .trim();
  const surd = /^(\d*(?:\.\d+)?)\\sqrt\{(\d)\}$/.exec(body);
  if (surd) return (surd[1] === '' ? 1 : Number(surd[1])) * Math.sqrt(Number(surd[2]));
  return Number(body);
};

describe('math-trig-rules', () => {
  it('sweep: every mode satisfies its own rule numerically', () => {
    const rad = (deg: number): number => (deg * Math.PI) / 180;
    sweep('math-trig-rules', trigRulesParams, drawTrigRules, buildTrigRules, (v) => {
      if (v.mode === 'sine-rule-side') {
        // b / sin B must equal a / sin A
        const value = exactNumber(v.answer);
        expect(value * Math.sin(rad(v.angleA))).toBeCloseTo(v.a * Math.sin(rad(v.angleB)), 6);
        return v.answer;
      }
      if (v.mode === 'sine-rule-angle') {
        expect(Math.sin(rad(v.answerValue))).toBeCloseTo((v.b * Math.sin(rad(v.angleA))) / v.a, 6);
        expect(v.angleA + v.answerValue).toBeLessThan(180);
        return `$${fmtNumber(v.answerValue)}^{\\circ}$`;
      }
      if (v.mode === 'cosine-rule-side') {
        const value = exactNumber(v.answer);
        expect(value * value).toBeCloseTo(v.b * v.b + v.c * v.c - 2 * v.b * v.c * Math.cos(rad(v.angleA)), 6);
        return v.answer;
      }
      if (v.mode === 'cosine-rule-angle') {
        const cosA = (v.b * v.b + v.c * v.c - v.a * v.a) / (2 * v.b * v.c);
        expect(Math.cos(rad(v.answerValue))).toBeCloseTo(cosA, 6);
        return `$${fmtNumber(v.answerValue)}^{\\circ}$`;
      }
      // area = ½bc·sinA
      const value = exactNumber(v.answer);
      expect(value).toBeCloseTo(0.5 * v.b * v.c * Math.sin(rad(v.angleA)), 6);
      return v.answer;
    });
  });

  it('never asks for an ambiguous sine-rule angle', () => {
    // The supplementary angle must not also make a valid triangle.
    const params: TrigRulesParams = { ...trigRulesParams, modes: ['sine-rule-angle'] };
    for (let i = 0; i < 80; i++) {
      const out = GENERATORS['math-trig-rules'].generate(params, createRng(`ambiguous:${i}`));
      const B = Number(/^\$(\d+)/.exec(out.correct)?.[1]);
      expect(out.stem).toContain('angle $A =');
      expect(Number.isFinite(B), out.correct).toBe(true);
      for (const choice of [out.correct, ...out.distractors]) {
        expect(Number.isFinite(Number(/^\$(\d+)/.exec(choice)?.[1])), choice).toBe(true);
      }
    }
  });
});

const trigIdentitiesParams: TrigIdentitiesParams = trigIdentitiesSchema.parse({
  degrees: [30, 45, 60, 90, 120, 135, 150, 180, 210, 240, 270, 300, 330, 360],
  multiples: [1, 2, 3, 4, 5, 7, 11],
  denominators: [2, 3, 4, 6, 9, 12],
  radii: [2, 3, 4, 5, 6, 8, 10, 12],
  sectorMultiples: [1, 2, 3, 4],
  sectorDenominators: [2, 3, 4, 6],
});

describe('math-trig-identities', () => {
  /** Independent reading of a printed kπ/n fraction. */
  const piValue = (choice: string): number => {
    const body = choice
      .replace(/\$/g, '')
      .replace(/\\text\{[^}]*\}/g, '')
      .replace(/\^2/g, '')
      .trim();
    if (body === '\\pi') return Math.PI;
    const whole = /^(\d+)\\pi$/.exec(body);
    if (whole) return Number(whole[1]) * Math.PI;
    const fraction = /^\\dfrac\{(\d*)\\pi\}\{(\d+)\}$/.exec(body);
    if (fraction) return ((fraction[1] === '' ? 1 : Number(fraction[1])) * Math.PI) / Number(fraction[2]);
    return Number.NaN;
  };

  const EXACT: Record<number, Record<string, string>> = {
    30: { sin: '$\\dfrac{1}{2}$', cos: '$\\dfrac{\\sqrt{3}}{2}$', tan: '$\\dfrac{\\sqrt{3}}{3}$' },
    45: { sin: '$\\dfrac{\\sqrt{2}}{2}$', cos: '$\\dfrac{\\sqrt{2}}{2}$', tan: '$1$' },
    60: { sin: '$\\dfrac{\\sqrt{3}}{2}$', cos: '$\\dfrac{1}{2}$', tan: '$\\sqrt{3}$' },
  };

  // Re-typed from the identity list, in the same order: an independent expectation rather
  // than a lookup into the generator's own table.
  const IDENTITY_ANSWERS = ['$1$', '$\\sin 2\\theta$', '$\\cos^2\\theta - \\sin^2\\theta$', '$\\sin\\theta$'];

  it('sweep: every exact value, sign and sector formula is re-derived here', () => {
    sweep('math-trig-identities', trigIdentitiesParams, drawTrigIdentities, buildTrigIdentities, (v) => {
      if (v.mode === 'degrees-to-radians') {
        expect(piValue(v.answer)).toBeCloseTo((v.degrees * Math.PI) / 180, 9);
        return v.answer;
      }
      if (v.mode === 'radians-to-degrees') {
        expect(v.answerValue).toBe((v.radianK * 180) / v.radianN);
        expect(Number.isInteger(v.answerValue)).toBe(true);
        return `$${fmtNumber(v.answerValue)}^{\\circ}$`;
      }
      if (v.mode === 'exact-value') {
        expect(v.answer).toBe(EXACT[v.degrees][v.fn]);
        return EXACT[v.degrees][v.fn];
      }
      if (v.mode === 'ratio-with-quadrant') {
        const [opposite, adjacent, hypotenuse] = v.triple;
        const positive = v.quadrant === 1 || v.quadrant === 4;
        expect(v.answerValue).toBeCloseTo((positive ? 1 : -1) * (adjacent / hypotenuse), 9);
        expect(positive ? v.answerValue > 0 : v.answerValue < 0).toBe(true);
        return v.answer;
      }
      if (v.mode === 'double-angle') {
        const [opposite, adjacent, hypotenuse] = v.triple;
        expect(v.answerValue).toBeCloseTo((2 * opposite * adjacent) / (hypotenuse * hypotenuse), 9);
        return v.answer;
      }
      if (v.mode === 'arc-length') {
        expect(piValue(v.answer)).toBeCloseTo((v.radius * v.radianK * Math.PI) / v.radianN, 9);
        return v.answer;
      }
      if (v.mode === 'sector-area') {
        expect(piValue(v.answer)).toBeCloseTo(
          (0.5 * v.radius * v.radius * v.radianK * Math.PI) / v.radianN,
          9
        );
        return v.answer;
      }
      expect(v.answer).toBe(IDENTITY_ANSWERS[v.identityIndex]);
      return v.answer;
    });
  });

  it('never returns a solved trig equation as a single value', () => {
    // The equation modes are deliberately absent: their answer is a SET. Guard the absence so
    // a future edit cannot slip one in with a one-element answer.
    for (let i = 0; i < 120; i++) {
      const out = GENERATORS['math-trig-identities'].generate(trigIdentitiesParams, createRng(`set:${i}`));
      expect(out.stem).not.toMatch(/Solve|solutions/i);
    }
  });
});
