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
