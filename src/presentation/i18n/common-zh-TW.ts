export const commonZhTW: Readonly<Record<string, string>> = {
  'Age boundary': '年齡邊界',
  'See also:': '另見：', 'What is': '名詞說明：', 'Words used on this screen:': '本頁用語：',
  'Those tax rules are held constant in real terms for the whole projection — bands, allowances and thresholds move with inflation and never otherwise change. Real tax law will change over a lifetime, and that risk is not modelled.': '整段推估期間，稅制維持相同的實質結構：級距、免稅額與門檻只隨通膨調整，不會有其他變動。實際稅法可能在一生中改變，此風險尚未納入模型。',
  'Words used here:': '本節用語：', 'Where this comes from:': '規則來源：',
  'How this works': '模型如何運作', 'What this model does with your numbers': '模型如何使用你的數字',
  'A plain-language walkthrough of the model: one year at a time, then many lifetimes at once, then what the results do and do not mean. Nothing on this page is a result — it explains the method, and every section says which files in the project the rule comes from.': '以白話了解模型：先看每年如何計算，再看多條人生路徑如何模擬，最後說明結果的意義與適用範圍。此頁說明方法，不呈現運算結果；各節也列出規則在專案中的來源。',
  'The same walkthrough is written up at': '相同的說明也收錄於', 'for reading away from the app.': '，可離開 app 閱讀。',
  'Back to': '返回', 'Screen by screen': '各頁面說明', 'What each of the eight screens answers': '八個頁面分別回答什麼',
  'Each screen asks one question of the same model. The screen you were on is open first; the rest are here so you can read ahead before you spend a run on one.': '各頁面向同一套模型提出不同問題。預設先展開你剛才使用的頁面，也可先閱讀其他頁面的說明，再決定是否花時間執行分析。',

};

export function translateCommonTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^All (\d+) terms$/.exec(value))) return `全部 ${m[1]} 個名詞`;
  if ((m = /^([\d,]+) of ([\d,]+) paths complete$/.exec(value))) return `已完成 ${m[1]}／${m[2]} 條路徑`;
  if ((m = /^Illustrative decision-support model, not regulated financial advice\. It uses the configured UK\/Scotland tax rules for (\d{4}\/\d{2}) and a parametric Monte Carlo market model\. Sampled results are not forecasts\.$/.exec(value))) return `這是協助比較決策的示例模型，並非受監管的財務建議。模型使用 ${m[1]} 年度已設定的英國／蘇格蘭稅制，以及參數化 Monte Carlo 市場模型。抽樣結果並非未來預測。`;
  if ((m = /^(.+)\. Median at age (\d+) is (.+), with a P10 to P90 range of (.+) to (.+)\.$/.exec(value))) return `${text(m[1]!)}。${m[2]} 歲的中位數為 ${m[3]}，P10 至 P90 區間為 ${m[4]} 至 ${m[5]}。`;
  return undefined;
}
