import originals from './fixtures/ot001-original.json';
import { expect, it } from 'vitest';
import { documentedMeasurement as metric } from '../src/documentedMeasurements';

it('projects full supported accounts with their explicit qualifiers and denominator', () => {
  expect(metric('initiation', 'Began the block-fitting activity after 3 verbal prompts.')?.value).toBe(3);
  expect(metric('attention', 'The child maintained attention for approximately eight minutes during the drawing activity.')).toMatchObject({ value: 8, qualifier: 'Approximately' });
  expect(metric('motor', 'Completed 7 independent block-fitting attempts out of 10.')).toMatchObject({ value: 7, denominator: 10 });
  expect(metric('transitions', 'Completed the transition within two minutes with verbal guidance.')).toMatchObject({ value: 2, qualifier: 'Within · verbal guidance' });
});
it('does not strip negation, uncertainty, unsupported ranges, or correction context', () => {
  for (const text of ['Did not maintain attention for approximately eight minutes.', 'Maintained attention for approximately eight minutes. This was later disputed.', 'May have maintained attention for approximately eight minutes.', 'Maintained attention for approximately 8–10 minutes.', 'Attention lasted 8 minutes.', 'Maintained attention for eight minutes.']) expect(metric('attention', text)).toBeNull();
  expect(metric('motor', 'Completed 11 independent attempts out of 10.')).toBeNull();
  expect(metric('motor', 'Completed 7 independent attempts out of 0.')).toBeNull();
  expect(metric('attention', 'Attention was supported with visual cues.')).toBeNull();
});

it('supports all exact original OT-001 reviewed wordings, including original assistance and bounds', () => {
  expect(originals.map(item => metric(item.topic, item.text)?.value)).toEqual([3,8,7,2]);
  expect(metric('motor', originals[2].text)).toMatchObject({ denominator: 10, qualifier: 'Both hands · minimal physical assistance for remaining attempts' });
  expect(metric('transitions', originals[3].text)?.qualifier).toContain('hesitation');
  for (const item of originals) {
    expect(metric(item.topic, 'Did not ' + item.text)).toBeNull();
    expect(metric(item.topic, item.text + ' This account was disputed.')).toBeNull();
    expect(metric(item.topic, item.text.replace(/^(Required|Maintained|Used|Hesitated)/, 'May have $1'))).toBeNull();
  }
  expect(metric('motor', originals[2].text.replace('minimal physical assistance', 'no physical assistance'))).toBeNull();
});
