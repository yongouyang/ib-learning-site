import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ORDER_FILE, checkTopicOrder, sortFilesByOrder } from '../../scripts/topic-order';
import { getSubjects } from '@/content/registry';
import { groupTopicsByStage } from '@/lib/topic-groups';

function makeSubjectDir(ids: string[]): { dir: string; files: string[] } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-order-'));
  const files = ids.map((id) => `${id}.json`);
  return { dir, files };
}

function writeOrder(dir: string, ids: unknown) {
  fs.writeFileSync(path.join(dir, ORDER_FILE), JSON.stringify(ids));
}

describe('topic-order checkTopicOrder', () => {
  it('accepts an exact, complete ordering', () => {
    const { dir, files } = makeSubjectDir(['a', 'b', 'c']);
    writeOrder(dir, ['c', 'a', 'b']);
    expect(checkTopicOrder('math', path.join(dir, ORDER_FILE), files)).toEqual([]);
  });

  it('reports a missing order.json', () => {
    const { dir, files } = makeSubjectDir(['a']);
    const errors = checkTopicOrder('math', path.join(dir, ORDER_FILE), files);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('missing or invalid');
  });

  it('reports a non-array order.json', () => {
    const { dir, files } = makeSubjectDir(['a']);
    writeOrder(dir, { a: 1 });
    expect(checkTopicOrder('math', path.join(dir, ORDER_FILE), files)).toEqual([
      `${ORDER_FILE} must be a JSON array of topic id strings`,
    ]);
  });

  it('reports duplicate ids', () => {
    const { dir, files } = makeSubjectDir(['a', 'b']);
    writeOrder(dir, ['a', 'a', 'b']);
    const errors = checkTopicOrder('math', path.join(dir, ORDER_FILE), files);
    expect(errors.some((e) => e.includes('duplicate ids: a'))).toBe(true);
  });

  it('reports unknown ids', () => {
    const { dir, files } = makeSubjectDir(['a']);
    writeOrder(dir, ['a', 'zzz']);
    const errors = checkTopicOrder('math', path.join(dir, ORDER_FILE), files);
    expect(errors.some((e) => e.includes('unknown topic ids: zzz'))).toBe(true);
  });

  it('reports missing ids', () => {
    const { dir, files } = makeSubjectDir(['a', 'b']);
    writeOrder(dir, ['a']);
    const errors = checkTopicOrder('math', path.join(dir, ORDER_FILE), files);
    expect(errors.some((e) => e.includes('missing topic ids: b'))).toBe(true);
  });
});

describe('topic-order sortFilesByOrder', () => {
  it('sorts files by the curated order', () => {
    const { dir, files } = makeSubjectDir(['a', 'b', 'c']);
    writeOrder(dir, ['c', 'a', 'b']);
    expect(sortFilesByOrder('math', path.join(dir, ORDER_FILE), files)).toEqual([
      'c.json',
      'a.json',
      'b.json',
    ]);
  });

  it('throws with all problems listed', () => {
    const { dir, files } = makeSubjectDir(['a', 'b']);
    writeOrder(dir, ['a', 'zzz']);
    expect(() => sortFilesByOrder('math', path.join(dir, ORDER_FILE), files)).toThrow(
      /unknown topic ids: zzz[\s\S]*missing topic ids: b/,
    );
  });
});

describe('registry topic ordering', () => {
  it('registry emits every subject in its order.json sequence', () => {
    for (const subject of getSubjects()) {
      const orderPath = path.join(
        process.cwd(),
        'src/content/data/topics',
        subject.id,
        ORDER_FILE,
      );
      const expected = JSON.parse(fs.readFileSync(orderPath, 'utf-8')) as string[];
      expect(subject.topics.map((t) => t.id)).toEqual(expected);
    }
  });

  it('groupTopicsByStage preserves registry order within each group', () => {
    for (const subject of getSubjects()) {
      const groups = groupTopicsByStage(subject.topics);
      const regrouped = groups.flatMap((g) => g.topics.map((t) => t.id));
      const byId = new Map(subject.topics.map((t, i) => [t.id, i]));
      for (let i = 1; i < regrouped.length; i++) {
        // Within the flat regrouped list, ids may jump across groups — only
        // consecutive same-group pairs must follow registry order.
        const prev = groups.find((g) => g.topics.some((t) => t.id === regrouped[i - 1]));
        const cur = groups.find((g) => g.topics.some((t) => t.id === regrouped[i]));
        if (prev === cur) {
          expect(byId.get(regrouped[i])!).toBeGreaterThan(byId.get(regrouped[i - 1])!);
        }
      }
    }
  });
});
