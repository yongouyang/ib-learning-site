import { describe, it, expect } from 'vitest';
import { createRng } from '@/lib/quiz-utils';
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

describe('registry', () => {
  it('registers all 12 pilot generators under kebab-case ids matching their module contract', () => {
    expect(Object.keys(GENERATORS).sort()).toEqual([
      'math-fraction-arithmetic',
      'math-linear-equation',
      'math-percent-of-amount',
      'phys-charge-current',
      'phys-efficiency',
      'phys-energy-kwh',
      'phys-fuse-rating',
      'phys-kinetic-energy',
      'phys-power',
      'phys-resistance-parallel',
      'phys-resistance-series',
      'phys-v-ir',
    ]);
    for (const [key, gen] of Object.entries(GENERATORS)) {
      expect(gen.id).toBe(key);
      expect(key).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
