export function translateFireTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Monte Carlo — ([\d,]+) paths$/.exec(value))) return `Monte Carlo — ${m[1]} 條路徑`;
  if ((m = /^(Meets the target|Below the target) of ([\d.]+%)$/.exec(value))) return `${text(m[1]!)} ${m[2]}`;
  if ((m = /^The band is a section 16 reading label only\. Your own ([\d.]+%) target is the figure every solver, curve and constraint is measured against\.$/.exec(value))) return `此分級僅為規格第 16 節的判讀標籤。所有 solver、曲線與限制，仍以你設定的 ${m[1]} 目標為準。`;
  if ((m = /^The share of sampled paths that funded every required year from today to age (\d+), including the pre-pension bridge\. A sampled model result, not a forecast or a guarantee\.$/.exec(value))) return `從現在到 ${m[1]} 歲，每年所需支出皆有資金支應的抽樣路徑比例，包含退休金可動用前的銜接期。這是抽樣模型結果，並非預測或保證。`;
  if ((m = /^Completed in ([\d.]+) seconds\. All requested paths ran; the count is never reduced\.$/.exec(value))) return `${m[1]} 秒完成。已執行全部指定路徑，未減少路徑數。`;
  if ((m = /^The first point is the opening balance at age (\d+); every later point is the closing balance at that age boundary, deflated to today’s money\. These figures are already real — do not deflate them again\.$/.exec(value))) return `第一個點是 ${m[1]} 歲的期初餘額；其後各點是該年齡邊界的期末餘額，已換算成今日幣值。這些數字已是實質金額，請勿再次扣除通膨。`;
  if ((m = /^(.+) percentiles by age, in today's money$/.exec(value))) return `${text(m[1]!)}各年齡百分位數，以今日幣值表示`;
  if ((m = /^Real investable wealth at age (\d+), including pension capital\.$/.exec(value))) return `${m[1]} 歲的實質可投資資產，包含退休金。`;
  if ((m = /^From age (\d+) to (\d+)\.$/.exec(value))) return `從 ${m[1]} 歲到 ${m[2]} 歲。`;
  if ((m = /^(Net worth|Investable wealth) at age (\d+)$/.exec(value))) return `${m[2]} 歲的${m[1] === 'Net worth' ? '淨資產' : '可投資資產'}`;
  if ((m = /^([\d.]+) years?$/.exec(value))) return `${m[1]} 年`;
  if ((m = /^(\d+) years? from the FIRE age$/.exec(value))) return `從 FIRE 年齡起 ${m[1]} 年`;
  if ((m = /^([\d.]+%) of paths$/.exec(value))) return `${m[1]} 的路徑`;
  if ((m = /^Conditional on an observed recovery to the pre-drawdown real peak, followed to the end age\. ([\d,]+) recovered, ([\d,]+) still censored at the end age\.$/.exec(value))) return `只計算有觀察到回復至回落前實質高點的路徑，追蹤至推估結束年齡。${m[1]} 條已復原，${m[2]} 條在結束時仍未觀察到復原。`;
  if ((m = /^constant_real — the configured (\d{4}-\d{2}) rules are held constant in real terms for the whole projection\. Future changes to tax law are not modelled; Where It Comes From tests a hypothetical extra charge on taxable pension withdrawals as one example of what such a change could cost\.$/.exec(value))) return `constant_real — 整段推估期間維持 ${m[1]} 年度稅制的實質結構。未模擬未來稅法變動；結果來源分析會以應稅退休金提領的假設額外稅負，示範此類變動可能帶來的影響。`;
  if ((m = /^(£[\d,.]+)\/month$/.exec(value))) return `${m[1]}／月`;
  if ((m = /^([\d.e+-]+) over (\d+) iterations$/.exec(value))) return `容許誤差 ${m[1]}，最多 ${m[2]} 次迭代`;
  if ((m = /^= (£[\d,.]+)\/yr$/.exec(value))) return `= ${m[1]}／年`;
  return undefined;
}
