export const en = {
  language: 'Language', overview: 'Overview', fire: 'FIRE & Monte Carlo',
  curve: 'FIRE Age Curve', marginal: 'Marginal Allocation', solver: 'Reverse Solver',
  scenarios: 'Scenario Comparison', property: 'Property & Leverage', attribution: 'Where It Comes From',
  skip: 'Skip to content', brand: 'Freedom Capital', subtitle: 'Lifetime allocation & FIRE model',
  start: 'Start here', firstResult: 'Build your first result', learn: 'How this works',
  plainModel: 'The model in plain language', screens: 'Analysis screens',
  age: 'Age', salary: 'Salary', fireAt: 'FIRE at', target: 'Target', success: 'success',
  current: 'Current', invalid: 'Inputs invalid',
} as const;
export type MessageKey = keyof typeof en;
