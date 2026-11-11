// SERVER-ONLY: public custom-exam content, separate from the premium paper registry.
import type { FreeResponseQuestion } from './types';
import { customTestBankSchema } from './schema';
import mathY7Bank from './data/custom-tests/math-y7.json';

const banks = [customTestBankSchema.parse(mathY7Bank)];

export function getCustomTestBankQuestions(courseId: string): FreeResponseQuestion[] {
  return banks.find((bank) => bank.courseId === courseId)?.questions ?? [];
}
