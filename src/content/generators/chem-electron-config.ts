import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { aufbauShells, pick, uniqueDistractors } from './utils';

// Electron configurations for Z = 1..20, in both directions:
// element -> config and config -> element. Configs are written in house style
// with commas and no spaces: "2,8,1".

const elementSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  z: z.number().int().min(1).max(20),
});

export const paramsSchema = z.object({
  elements: z.array(elementSchema).min(4),
  modes: z.array(z.enum(['to-config', 'to-element'])).optional(),
});
export type ElectronConfigParams = z.infer<typeof paramsSchema>;

type Mode = 'to-config' | 'to-element';

export interface ElectronConfigValues {
  mode: Mode;
  symbol: string;
  name: string;
  z: number;
  shells: number[];
  /** mode to-element: distractor names resolved from the params table. */
  nameCandidates: string[];
  /** mode to-element: fallback pool of every name in the params table. */
  namePool: string[];
}

export function draw(params: ElectronConfigParams, rng: Rng): ElectronConfigValues {
  const mode: Mode = pick(params.modes ?? ['to-config', 'to-element'], rng);
  const element = pick(params.elements, rng);
  const shells = aufbauShells(element.z);
  if (mode === 'to-element') {
    const byZ = new Map(params.elements.map((e) => [e.z, e]));
    const nameCandidates: string[] = [];
    const zMinus = byZ.get(element.z - 1);
    const zPlus = byZ.get(element.z + 1);
    if (zMinus) nameCandidates.push(zMinus.name);
    if (zPlus) nameCandidates.push(zPlus.name);
    // Same group, different period: same outer-shell count, different shell count.
    for (const other of params.elements) {
      if (other.z === element.z) continue;
      const otherShells = aufbauShells(other.z);
      if (
        otherShells.length !== shells.length &&
        otherShells[otherShells.length - 1] === shells[shells.length - 1]
      ) {
        nameCandidates.push(other.name);
        break;
      }
    }
    return {
      mode,
      symbol: element.symbol,
      name: element.name,
      z: element.z,
      shells,
      nameCandidates,
      namePool: params.elements.map((e) => e.name),
    };
  }
  return {
    mode,
    symbol: element.symbol,
    name: element.name,
    z: element.z,
    shells,
    nameCandidates: [],
    namePool: [],
  };
}

// Every config string for Z = 1..20 — a large plausible-but-wrong fallback pool.
function allConfigs(): string[] {
  return Array.from({ length: 20 }, (_, i) => aufbauShells(i + 1).join(','));
}

function shellSum(shells: number[]): string {
  return shells.join('+');
}

export function build(values: ElectronConfigValues, rng: Rng): GeneratorOutput {
  const { mode, name, z, shells } = values;
  const config = shells.join(',');
  if (mode === 'to-config') {
    const candidates: string[] = [];
    if (z > 1) candidates.push(aufbauShells(z - 1).join(',')); // Z - 1
    if (z < 20) candidates.push(aufbauShells(z + 1).join(',')); // Z + 1
    // Shell slip: with 3+ shells, merge the last two (2,8,1 -> 2,9); with 2
    // shells, reverse them (2,8 -> 8,2).
    if (shells.length >= 3) {
      candidates.push(
        [...shells.slice(0, -2), shells[shells.length - 2] + shells[shells.length - 1]].join(',')
      );
    } else if (shells.length === 2) {
      candidates.push([...shells].reverse().join(','));
    }
    // Period confusion for K/Ca: third shell over-filled instead of starting 4s.
    if (z === 19 || z === 20) candidates.push([2, 8, 8 + (z - 18)].join(','));
    const distractors = uniqueDistractors(config, candidates, allConfigs(), rng);
    const periodNote =
      z === 19 || z === 20
        ? ` The outer electron goes into shell 4 (4s) before shell 3 fills — 2,8,9 is the classic trap.`
        : '';
    return {
      stem: `What is the electron configuration of ${name} (atomic number ${z})?`,
      correct: config,
      distractors,
      explanation: String.raw`Shells fill in order 2, 8, 8: $${shellSum(shells)}=${z}$ electrons for ${name}, so the configuration is ${config}.${periodNote}`,
    };
  }
  const distractors = uniqueDistractors(values.name, values.nameCandidates, values.namePool, rng);
  return {
    stem: `An atom has the electron configuration ${config}. Which element is it?`,
    correct: values.name,
    distractors,
    explanation: String.raw`$${shellSum(shells)}=${z}$ electrons, and in a neutral atom electrons = protons, so the atomic number is ${z} — ${name}.`,
  };
}

export const chemElectronConfig: QuestionGenerator<ElectronConfigParams> = {
  id: 'chem-electron-config',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
