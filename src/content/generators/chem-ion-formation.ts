import { z } from 'zod';
import type { GeneratorOutput, QuestionGenerator, Rng } from './types';
import { aufbauShells, chargeSuperscript, pick, uniqueDistractors } from './utils';

// Ion formation for s/p-block elements: which ion an atom forms (charge mode)
// and the electron configuration of the resulting ion (config mode). Metals
// (groups 1, 2, 13) lose electrons; non-metals (groups 16, 17) gain them.

const elementSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  z: z.number().int().min(1).max(20),
  group: z.union([z.literal(1), z.literal(2), z.literal(13), z.literal(16), z.literal(17)]),
});

export const paramsSchema = z.object({
  elements: z.array(elementSchema).min(2),
  modes: z.array(z.enum(['ion-charge', 'ion-config'])).optional(),
});
export type IonFormationParams = z.infer<typeof paramsSchema>;

type Group = 1 | 2 | 13 | 16 | 17;
type Mode = 'ion-charge' | 'ion-config';

export interface IonFormationValues {
  mode: Mode;
  symbol: string;
  name: string;
  z: number;
  group: Group;
}

/** Signed ion charge for a group: Group 1 -> +1, 13 -> +3, 16 -> -2, 17 -> -1. */
export function chargeForGroup(group: Group): number {
  if (group === 1) return 1;
  if (group === 2) return 2;
  if (group === 13) return 3;
  if (group === 16) return -2;
  return -1;
}

export function draw(params: IonFormationParams, rng: Rng): IonFormationValues {
  const mode: Mode = pick(params.modes ?? ['ion-charge', 'ion-config'], rng);
  // Config mode needs the ion to keep at least one electron (rules out H+).
  const pool =
    mode === 'ion-config'
      ? params.elements.filter((e) => e.z - chargeForGroup(e.group) >= 1)
      : params.elements;
  const element = pick(pool.length > 0 ? pool : params.elements, rng);
  return {
    mode,
    symbol: element.symbol,
    name: element.name,
    z: element.z,
    group: element.group,
  };
}

export function build(values: IonFormationValues, rng: Rng): GeneratorOutput {
  const { mode, symbol, name, z, group } = values;
  const charge = chargeForGroup(group);
  const magnitude = Math.abs(charge);
  const isMetal = charge > 0;
  const atomConfig = aufbauShells(z).join(',');
  const ionConfig = aufbauShells(z - charge).join(',');
  const sign = isMetal ? ('+' as const) : ('-' as const);
  const ion = (mag: number, s: '+' | '-') => `${symbol}${chargeSuperscript(mag, s)}`;

  if (mode === 'ion-charge') {
    const correct = ion(magnitude, sign);
    const candidates: string[] = [
      ion(magnitude, isMetal ? '-' : '+'), // wrong sign
    ];
    if (magnitude < 3) candidates.push(ion(magnitude + 1, sign)); // wrong magnitude
    if (magnitude > 1) candidates.push(ion(magnitude - 1, sign));
    // Group number taken as the charge (Group 17 -> 7-).
    if (group >= 16) candidates.push(ion(group, sign));
    candidates.push(`${name} does not form an ion`);
    const fallbackPool = [1, 2, 3].flatMap((m) => [ion(m, '+'), ion(m, '-')]);
    const distractors = uniqueDistractors(correct, candidates, fallbackPool, rng);
    const electronWord = magnitude === 1 ? 'electron' : 'electrons';
    const action = isMetal ? 'loses' : 'gains';
    return {
      stem: `What ion does ${name} (${atomConfig}) form?`,
      correct,
      distractors,
      explanation: String.raw`${capitalise(name)} is in Group ${group}, so it ${action} ${magnitude} outer ${electronWord}: $${z}${isMetal ? '-' : '+'}${magnitude}=${z - charge}$ electrons, giving charge $${charge > 0 ? '+' : ''}${charge}$ — ${correct}.`,
    };
  }

  // ion-config mode
  const correct = ionConfig;
  const atomShells = aufbauShells(z);
  const wrongShell = [...atomShells];
  // Move the electron change to the second-outermost shell instead.
  const innerIndex = Math.max(0, wrongShell.length - 2);
  wrongShell[innerIndex] += isMetal ? -magnitude : magnitude;
  const wrongDirection = aufbauShells(z + charge).join(','); // gain vs loss flipped
  const candidates = [atomConfig, wrongShell.join(','), wrongDirection];
  const fallbackPool = Array.from({ length: 20 }, (_, i) => aufbauShells(i + 1).join(','));
  const distractors = uniqueDistractors(correct, candidates, fallbackPool, rng);
  const electronWord = magnitude === 1 ? 'electron' : 'electrons';
  const action = isMetal ? 'loses' : 'gains';
  return {
    stem: `A ${name} atom (${atomConfig}) ${action} ${magnitude} ${electronWord}. What is the electron configuration of the ion it forms?`,
    correct,
    distractors,
    explanation: String.raw`${capitalise(name)} is in Group ${group}, so it ${action} ${magnitude} ${electronWord}: $${z}${isMetal ? '-' : '+'}${magnitude}=${z - charge}$ electrons, giving ${correct}. The atom's own configuration (${atomConfig}) is the trap.`,
  };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const chemIonFormation: QuestionGenerator<IonFormationParams> = {
  id: 'chem-ion-formation',
  difficulty: 'medium',
  paramsSchema,
  generate(params, rng) {
    return build(draw(params, rng), rng);
  },
};
