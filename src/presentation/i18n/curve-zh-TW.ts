/** FIRE age curve display copy. Engine results and path identities remain unchanged. */
export const curveZhTW: Readonly<Record<string, string>> = {
  'No candidate age could be simulated, so there is no curve to draw.': '所有候選年齡都無法執行模擬，因此沒有可繪製的曲線。',
  'Note.': '說明。',
  'FIRE age': 'FIRE 年齡',
  'Candidate FIRE age': '候選 FIRE 年齡',
  'Inputs changed, so the previous curve was discarded': '輸入已變更，先前曲線已清除',
  'Each point is only valid for the exact inputs that produced it. Any run in flight was cancelled. Recompute the curve to see results for the current profile.': '每個點只適用於產生它的原始輸入。進行中的運算已取消，請重新計算目前資料的曲線。',
  'No partial curve is published: the ages that had finished are discarded with the rest.': '不會發布未完成的曲線；已算完的年齡也會一併清除。',
  'The curve could not be computed': '無法計算曲線',
  'Candidate ages': '候選年齡',
  'Run the whole model at every FIRE age': '對每個 FIRE 年齡執行完整模型',
  'Instead of one FIRE age, each candidate age is simulated in full on the same seed and the same path indices, and the earliest age clearing your target probability is read off the result. Moving the FIRE age changes when salary and pension contributions stop, which years use the retirement budget and how long the pre-pension bridge runs — the ledger handles all of it.': '每個候選 FIRE 年齡都使用相同種子與路徑索引執行完整模擬，再從結果找出最早達到目標成功率的年齡。調整 FIRE 年齡會改變薪資與退休金提撥停止的時間、使用退休預算的年度，以及退休金可動用前的銜接期；帳本會一併處理這些變動。',
  'First candidate FIRE age': '第一個候選 FIRE 年齡',
  'Last candidate FIRE age': '最後一個候選 FIRE 年齡',
  'Every whole age from here upwards is simulated in full.': '從此年齡開始，每個整數年齡都會執行完整模擬。',
  'Must be below the simulation end age. A wider range is a proportionally longer run.': '必須小於模擬結束年齡。範圍越廣，運算時間也會相應增加。',
  'Computing…': '計算中…',
  'No curve yet': '尚未產生曲線',
  'Nothing is shown until every candidate age has run': '全部候選年齡完成後才會顯示結果',
  'An age with no simulation behind it has no probability, so none is drawn. Press Compute above.': '尚未模擬的年齡沒有成功率，因此不會繪製。請按上方的計算按鈕。',
  'Clears the target': '達到目標', 'Below the target': '低於目標', 'No age clears the target': '沒有年齡達標',
  'No candidate age reached the target': '沒有候選年齡達到目標',
  'Earliest FIRE age reaching the target': '最早達到目標的 FIRE 年齡',
  'Probability at your target FIRE age': '目標 FIRE 年齡的成功率', 'not in range': '不在測試範圍內',
  'Probability by FIRE age': '各 FIRE 年齡的成功率',
  'Every candidate age, simulated in full': '每個候選年齡皆完整模擬',
  'The dashed line is the target probability and the filled point is the earliest age reaching it. Points are joined only to make the shape readable; ages between whole years were never simulated.': '虛線代表目標成功率，實心點代表最早達標年齡。連線僅方便閱讀曲線形狀；整數年齡之間並未執行模擬。',
  'Success probability by FIRE age, on common market paths. Money is today’s money.': '使用配對市場路徑計算各 FIRE 年齡的成功率。金額為今日幣值。',
  'Sampling ±95%': '95% 抽樣誤差 ±', 'Bridge years': '銜接期年數',
  'Median capital at FIRE': 'FIRE 時資本中位數', 'Against target': '與目標比較',
  'What produced this curve': '本次曲線的計算依據', 'Curve metadata': '曲線中繼資料',
  'Success probability did not rise with every extra year of work on this curve. Retiring later interacts with a property purchase, a mortgage term and the pension access age, so read the whole curve rather than the earliest qualifying age alone.': '這條曲線的成功率並未隨每多工作一年而持續上升。延後退休會與購屋、房貸期限及退休金可動用年齡互相影響，因此請閱讀整條曲線，並一併考量最早達標年齡。',
  'Some candidate ages could not be simulated; they are listed with the reason and left out of the curve rather than interpolated.': '部分候選年齡無法模擬，已列出原因並從曲線排除，不會用內插值補上。',
  'Limit the range to 61 candidate ages.': '每次運算最多涵蓋 61 個年齡。',
};

export function translateCurveTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Age (\d+): (\d+) of (\d+) ages complete$/.exec(value))) return `${m[1]} 歲：已完成 ${m[2]}／${m[3]} 個年齡`;
  if ((m = /^Compute ([\d,]+) ages$/.exec(value))) return `計算 ${m[1]} 個年齡`;
  if ((m = /^Simulation progress for age (\d+)$/.exec(value))) return `${m[1]} 歲的模擬進度`;
  if ((m = /^target (.+)$/.exec(value))) return `目標 ${m[1]}`;
  if ((m = /^Age (\d+): ([\d.]+%)$/.exec(value))) return `${m[1]} 歲：${m[2]}`;
  if ((m = /^Age (\d+), the FIRE age entered on the profile\.$/.exec(value))) return `${m[1]} 歲，即個人資料設定的 FIRE 年齡。`;
  if ((m = /^(.+) of retirement spending ÷ the reference withdrawal rate\.$/.exec(value))) return `退休支出 ${m[1]} ÷ 參考提領率。`;
  if ((m = /^This run is ([\d,]+) complete simulations — ([\d,]+) lifetime projections at the configured path count\. The count is never reduced to make the curve finish sooner; lower the path count above if you want a faster, less precise curve\.$/.exec(value))) return `本次會執行 ${m[1]} 次完整模擬，依設定路徑數共推估 ${m[2]} 個完整人生。系統不會自行減少路徑數來加快運算；若希望更快完成且可接受較低精確度，可在上方調低路徑數。`;
  if ((m = /^Completed in ([\d.]+) seconds\. The ± figure is Monte Carlo sampling uncertainty at 95%, not a range of outcomes and not a bound on the model’s assumptions\.$/.exec(value))) return `已於 ${m[1]} 秒完成。± 數字為 95% Monte Carlo 抽樣不確定性，並非結果範圍，也不包含模型假設的不確定性。`;
  if ((m = /^Every age used seed (\d+) and path indices (\d+)–(\d+), so differences between ages are differences in the plan, not in the draw\.$/.exec(value))) return `各年齡皆使用種子 ${m[1]} 與路徑索引 ${m[2]}–${m[3]}，因此年齡間的差異來自計畫本身，而非不同的隨機抽樣。`;
  if ((m = /^No FIRE age from (.+) reached (.+) success\. Extending the range, spending less or saving more are all separate searches on the Reverse Solver\.$/.exec(value))) return `${m[1] === 'the requested range' ? '指定範圍' : m[1]!.replace(' to ', '–') + ' 歲'}內，沒有 FIRE 年齡達到 ${m[2]} 成功率。擴大範圍、降低支出或增加儲蓄，可分別在反向求解頁面測試。`;
  if ((m = /^Reaching (.+) against a (.+) target, with a (\d+)-year pre-pension bridge\. Every age from (\d+) to (\d+) was simulated in full on the same paths\.$/.exec(value))) return `成功率為 ${text(m[1]!)}，目標為 ${m[2]}，退休金可動用前的銜接期為 ${m[3]} 年。${m[4]} 至 ${m[5]} 歲皆已使用相同路徑執行完整模擬。`;
  if ((m = /^Not simulated: (.+)$/.exec(value))) return `未模擬：${text(m[1]!)}`;
  if ((m = /^Enter a whole age between (\d+) and (\d+)\.$/.exec(value))) return `請輸入 ${m[1]} 至 ${m[2]} 之間的整數年齡。`;
  if ((m = /^Enter a whole age between the first candidate age and (\d+)\.$/.exec(value))) return `請輸入介於第一個候選年齡與 ${m[1]} 歲之間的整數年齡。`;
  if ((m = /^Success probability by FIRE age, from age (\d+) to (\d+)\. (.+)$/.exec(value))) return `各 FIRE 年齡的成功率，範圍 ${m[1]} 至 ${m[2]} 歲。${m[3] === 'No age reaches the target.' ? '沒有年齡達到目標。' : text(m[3]!)}`;
  if ((m = /^Age (\d+) is the earliest reaching the (.+) target\.$/.exec(value))) return `${m[1]} 歲最早達到 ${m[2]} 目標。`;
  return undefined;
}
