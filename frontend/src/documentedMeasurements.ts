/** Conservative display projection, not general clinical NLP. Whole reviewed
 * sentences must match a supported template; qualifiers cannot be discarded. */
const quantity = '(\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const numbers = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const prefix = '(?:The (?:synthetic )?child )?';
const templates: Record<string, RegExp> = {
  initiation: new RegExp('^' + prefix + '(?:Began|Started) (?:the block-fitting activity|the block task|a synthetic activity|the activity) after ' + quantity + ' verbal prompts\\.$', 'i'),
  attention: new RegExp('^' + prefix + 'Maintained attention for approximately ' + quantity + ' minutes(?: during (?:the |the drawing |a drawing )?activity)?\\.$', 'i'),
  motor: new RegExp('^' + prefix + 'Completed ' + quantity + ' independent (?:block-fitting )?attempts out of ' + quantity + '(?: block-fitting attempts)?\\.$', 'i'),
  transitions: new RegExp('^' + prefix + 'Completed the transition within ' + quantity + ' minutes with verbal guidance\\.$', 'i'),
};
// Additional full-sentence forms from the original user-supplied OT-001
// narratives. All surrounding clauses are mandatory, never discarded.
const originalTemplates: Record<string, RegExp> = {
  initiation: new RegExp('^Required ' + quantity + ' verbal prompts to begin the block-fitting activity[.]?$', 'i'),
  attention: new RegExp('^Maintained attention for approximately ' + quantity + ' minutes during the block-fitting task[.]?$', 'i'),
  motor: new RegExp('^Used both hands to manipulate blocks and completed ' + quantity + ' of ' + quantity + ' fitting attempts independently, with minimal physical assistance for the remaining attempts[.]?$', 'i'),
  transitions: new RegExp('^Hesitated during transition to a second activity but responded to verbal guidance and completed the transition within ' + quantity + ' minutes[.]?$', 'i'),
};
export function documentedMeasurement(topic: string, reviewedText: string): { value: number; denominator?: number; label: string; qualifier: string } | null {
  const original = originalTemplates[topic]?.exec(reviewedText.trim());
  const match = original || templates[topic]?.exec(reviewedText.trim());
  if (!match) return null;
  const parse = (token: string) => /^\d+$/.test(token) ? Number(token) : numbers.indexOf(token.toLowerCase());
  const value = parse(match[1]);
  const denominator = match[2] ? parse(match[2]) : undefined;
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000 || (denominator !== undefined && (denominator <= 0 || denominator > 10000 || value > denominator))) return null;
  const labels: Record<string, [string, string]> = { initiation: ['verbal prompts', 'Recorded'], attention: ['minutes attention', 'Approximately'], motor: ['independent attempts', 'Documented'], transitions: ['minutes to transition', 'Within · verbal guidance'] };
  return { value, denominator, label: labels[topic][0], qualifier: original && topic === 'motor' ? 'Both hands · minimal physical assistance for remaining attempts' : original && topic === 'transitions' ? 'Within · verbal guidance · hesitation recorded' : labels[topic][1] };
}
