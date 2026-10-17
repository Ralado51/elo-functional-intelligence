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
export function documentedMeasurement(topic: string, reviewedText: string): { value: number; denominator?: number; label: string; qualifier: string } | null {
  const match = templates[topic]?.exec(reviewedText.trim());
  if (!match) return null;
  const parse = (token: string) => /^\d+$/.test(token) ? Number(token) : numbers.indexOf(token.toLowerCase());
  const value = parse(match[1]);
  const denominator = match[2] ? parse(match[2]) : undefined;
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000 || (denominator !== undefined && (denominator <= 0 || denominator > 10000 || value > denominator))) return null;
  const labels: Record<string, [string, string]> = { initiation: ['verbal prompts', 'Recorded'], attention: ['minutes attention', 'Approximately'], motor: ['independent attempts', 'Documented'], transitions: ['minutes to transition', 'Within · verbal guidance'] };
  return { value, denominator, label: labels[topic][0], qualifier: labels[topic][1] };
}
