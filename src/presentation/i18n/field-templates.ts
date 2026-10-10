/** Variable field headings retain their indices; only the authored words are localized. */
const templates: readonly [RegExp, (...parts: string[]) => string][] = [
  [/^Refinance (\d+) age$/, n => `第 ${n} 次轉貸年齡`],
  [/^Refinance (\d+) rate$/, n => `第 ${n} 次轉貸利率`],
  [/^Phase (\d+) start age$/, n => `第 ${n} 階段開始年齡`],
  [/^Phase (\d+) end age$/, n => `第 ${n} 階段結束年齡`],
  [/^Phase (\d+) essential$/, n => `第 ${n} 階段必要支出`],
  [/^Phase (\d+) discretionary$/, n => `第 ${n} 階段彈性支出`],
  [/^Capital need (\d+) age$/, n => `第 ${n} 筆大額支出的年齡`],
  [/^Capital need (\d+) amount$/, n => `第 ${n} 筆大額支出的金額`],
];
const markets: Readonly<Record<string, string>> = {
  equities: '股票', bonds: '債券', cash: '現金', property: '房產', inflation: '通膨',
};
export function translateFieldTemplate(value: string): string | undefined {
  for (const [pattern, render] of templates) {
    const match = pattern.exec(value);
    if (match) return render(...match.slice(1));
  }
  const match = /^(equities|bonds|cash|property|inflation) \/ (equities|bonds|cash|property|inflation) log-shock correlation$/.exec(value);
  return match ? `${markets[match[1]!]}／${markets[match[2]!]}對數衝擊相關性` : undefined;
}
