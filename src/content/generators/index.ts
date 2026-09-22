import type { QuestionGenerator } from './types';
import { mathLinearEquation } from './math-linear-equation';
import { mathPercentOfAmount } from './math-percent-of-amount';
import { mathFractionArithmetic } from './math-fraction-arithmetic';
import { mathRounding } from './math-rounding';
import { mathIndices } from './math-indices';
import { mathStatistics } from './math-statistics';
import { mathLinearSequence } from './math-linear-sequence';
import { mathSubstitution } from './math-substitution';
import { mathShapeMeasure } from './math-shape-measure';
import { mathStandardForm } from './math-standard-form';
import { mathAlgebraManipulation } from './math-algebra-manipulation';
import { mathFrequencyDensity } from './math-frequency-density';
import { mathQuadratic } from './math-quadratic';
import { mathVolumeSurface } from './math-volume-surface-area';
import { physVIr } from './phys-v-ir';
import { physResistanceSeries } from './phys-resistance-series';
import { physResistanceParallel } from './phys-resistance-parallel';
import { physChargeCurrent } from './phys-charge-current';
import { physEnergyKwh } from './phys-energy-kwh';
import { physFuseRating } from './phys-fuse-rating';
import { physKineticEnergy } from './phys-kinetic-energy';
import { physEfficiency } from './phys-efficiency';
import { physPower } from './phys-power';
import { physSpeed } from './phys-speed';
import { physPressure } from './phys-pressure';
import { physDensity } from './phys-density';
import { physWaveSpeed } from './phys-wave-speed';
import { physThermalEnergy } from './phys-thermal-energy';
import { chemCompoundNaming } from './chem-compound-naming';
import { chemElectronConfig } from './chem-electron-config';
import { chemHalfLife } from './chem-half-life';
import { chemIonFormation } from './chem-ion-formation';
import { chemIsotopeRam } from './chem-isotope-ram';
import { chemPhRatio } from './chem-ph-ratio';

// Registry of parameterized question templates (docs/question-variations-plan.md,
// Phase 2). Topic JSON `templates[].generator` values must be keys here —
// enforced by checkTemplates in scripts/validate-content.ts. Typed as unknown
// params: each generator validates its own params table via paramsSchema.
const all: QuestionGenerator<unknown>[] = [
  mathLinearEquation,
  mathPercentOfAmount,
  mathFractionArithmetic,
  mathRounding,
  mathIndices,
  mathStatistics,
  mathLinearSequence,
  mathSubstitution,
  mathShapeMeasure,
  mathStandardForm,
  mathAlgebraManipulation,
  mathFrequencyDensity,
  mathQuadratic,
  mathVolumeSurface,
  physVIr,
  physResistanceSeries,
  physResistanceParallel,
  physChargeCurrent,
  physEnergyKwh,
  physFuseRating,
  physKineticEnergy,
  physEfficiency,
  physPower,
  physSpeed,
  physPressure,
  physDensity,
  physWaveSpeed,
  physThermalEnergy,
  chemElectronConfig,
  chemIonFormation,
  chemIsotopeRam,
  chemHalfLife,
  chemPhRatio,
  chemCompoundNaming,
];

export const GENERATORS: Record<string, QuestionGenerator<unknown>> = Object.fromEntries(
  all.map((g) => [g.id, g])
);

export function getGenerator(id: string): QuestionGenerator<unknown> | undefined {
  return GENERATORS[id];
}
