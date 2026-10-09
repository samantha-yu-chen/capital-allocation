export const commonZhTW: Readonly<Record<string, string>> = {
  'See also:': '另見：', 'What is': '名詞說明：', 'Words used on this screen:': '本頁用語：',
  'Those tax rules are held constant in real terms for the whole projection — bands, allowances and thresholds move with inflation and never otherwise change. Real tax law will change over a lifetime, and that risk is not modelled.': '整段推估期間，稅制維持相同的實質結構：級距、免稅額與門檻只隨通膨調整，不會有其他變動。實際稅法可能在一生中改變，此風險尚未納入模型。',
};

export function translateCommonTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^All (\d+) terms$/.exec(value))) return `全部 ${m[1]} 個名詞`;
  if ((m = /^([\d,]+) of ([\d,]+) paths complete$/.exec(value))) return `已完成 ${m[1]}／${m[2]} 條路徑`;
  if ((m = /^Illustrative decision-support model, not regulated financial advice\. It uses the configured UK\/Scotland tax rules for (\d{4}\/\d{2}) and a parametric Monte Carlo market model\. Sampled results are not forecasts\.$/.exec(value))) return `這是協助比較決策的示例模型，並非受監管的財務建議。模型使用 ${m[1]} 年度已設定的英國／蘇格蘭稅制，以及參數化 Monte Carlo 市場模型。抽樣結果並非未來預測。`;
  if ((m = /^(.+)\. Median at age (\d+) is (.+), with a P10 to P90 range of (.+) to (.+)\.$/.exec(value))) return `${text(m[1]!)}。${m[2]} 歲的中位數為 ${m[3]}，P10 至 P90 區間為 ${m[4]} 至 ${m[5]}。`;
  return undefined;
}
