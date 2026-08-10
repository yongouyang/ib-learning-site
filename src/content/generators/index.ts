import type { QuestionGenerator } from './types';
import { mathLinearEquation } from './math-linear-equation';
import { mathPercentOfAmount } from './math-percent-of-amount';
import { mathFractionArithmetic } from './math-fraction-arithmetic';
import { physVIr } from './phys-v-ir';
import { physResistanceSeries } from './phys-resistance-series';
import { physResistanceParallel } from './phys-resistance-parallel';
import { physChargeCurrent } from './phys-charge-current';
import { physEnergyKwh } from './phys-energy-kwh';
import { physFuseRating } from './phys-fuse-rating';
import { physKineticEnergy } from './phys-kinetic-energy';
import { physEfficiency } from './phys-efficiency';
import { physPower } from './phys-power';

// Registry of parameterized question templates (docs/question-variations-plan.md,
// Phase 2). Topic JSON `templates[].generator` values must be keys here —
// enforced by checkTemplates in scripts/validate-content.ts. Typed as unknown
// params: each generator validates its own params table via paramsSchema.
const all: QuestionGenerator<unknown>[] = [
  mathLinearEquation,
  mathPercentOfAmount,
  mathFractionArithmetic,
  physVIr,
  physResistanceSeries,
  physResistanceParallel,
  physChargeCurrent,
  physEnergyKwh,
  physFuseRating,
  physKineticEnergy,
  physEfficiency,
  physPower,
];

export const GENERATORS: Record<string, QuestionGenerator<unknown>> = Object.fromEntries(
  all.map((g) => [g.id, g])
);

export function getGenerator(id: string): QuestionGenerator<unknown> | undefined {
  return GENERATORS[id];
}
