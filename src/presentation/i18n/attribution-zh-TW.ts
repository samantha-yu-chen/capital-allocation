/** Assumption tests and synthetic stresses: presentation only, no causal claims added. */
export const attributionZhTW: Readonly<Record<string,string>> = {
  'Inputs changed, so the previous analysis was discarded': '輸入已變更，先前分析已清除',
  'No partial attribution is published.': '不會發布未完成的結果來源分析。',
  '. No partial attribution is published.': '。不會發布未完成的結果來源分析。',
  'Analysis could not be computed': '無法計算分析結果',
  'Where It Comes From': '結果來源分析', 'Which changes move your plan?': '哪些調整會影響你的計畫？',
  'Compare income, expenses, time, allocation, investment risk and property using your complete lifetime model.': '使用完整終身模型，比較收入、支出、時間、資金配置、投資風險與房產的影響。',
  'Stresses use this start age, which defaults to today. To inspect retirement sequence risk, choose your target FIRE age. Configure property on Property & Leverage to include its comparisons.': '壓力測試從此年齡開始，預設為目前年齡。若要檢查退休後的報酬順序風險，請選目標 FIRE 年齡。先在房產與槓桿頁面設定房產，即可納入相關比較。',
  'Compute levers and stresses': '計算調整效果與壓力測試', 'Attribution path progress': '結果來源分析的路徑進度',
  'How to read this': '如何判讀', 'Tested effects and their limits': '已測試的效果與限制',
  'Completed full-count analysis': '完整路徑數分析已完成',
  'What has the largest tested effect?': '哪項已測試調整的影響最大？',
  'One change at a time': '每次調整一項', 'FIRE probability effects': 'FIRE 成功率影響',
  'Bar length is absolute probability change on a 0–100 percentage-point scale. Read the signed delta and uncertainty beside each bar.': '長條長度代表成功率變化的絕對值，刻度為 0–100 百分點。請一併閱讀旁邊帶正負號的變化與不確定性。',
  'Lever outcomes': '調整效果', 'Sensitivity: nine assumption families': '敏感度：九類假設',
  'Observed failures': '觀察到的資金不足',
  'Funding events and diagnostic risk factors': '資金不足事件與風險關聯檢查',
  'These baseline failure events overlap; do not sum them. High spending and low savings are tested through interventions above, not assigned invented causal percentages.': '這些基準資金不足事件可能重疊，請勿加總。高支出與低儲蓄透過上方的調整測試衡量，不會被賦予未經證實的因果百分比。',
  'Deterministic stress paths': '固定壓力路徑', 'Synthetic adverse conditions': '人為設定的不利條件',
  'No historical backtest is implied. These are single assumed paths, not probabilities. Outside the stated shock window, entered nominal means apply; multi-year shocks end at the projection horizon.': '這些測試不代表歷史回測。每個都是一條假設路徑，沒有附帶發生機率。指定衝擊期間以外使用輸入的名目平均值；多年衝擊不會超出推估結束時間。',
  'Terminal net worth, today:': '期末淨資產（今日幣值）：',
  'Change versus deterministic mean path:': '相對固定平均路徑的變化：',
  'Funding failure audit': '資金不足明細',
  'Unsupported: no stress result.': '不支援：沒有壓力測試結果。',
  'No recorded funding failures.': '未記錄資金不足。',
  'Recompute and audit': '重算與檢查', 'Versioned inputs and complete engine results': '具版本的輸入與完整 engine 結果',
  'Per-case profiles, options, engine results and deterministic stress ledgers': '各情境資料、選項、engine 結果與固定壓力帳本',
  'Full lifetime reruns': '完整終身模型重跑', 'Test': '測試', 'Success / change': '成功率／變化',
  'Bridge failure': '銜接期資金不足', 'FIRE age / spending': 'FIRE 年齡／支出',
  'Median liquid / pension / property at FIRE': 'FIRE 時可動用資產／退休金／房產中位數',
  'Terminal median / P10': '期末中位數／P10', 'Unsupported:': '不支援：',
  'Wealth is in today’s GBP. The listed FIRE age is the plan’s target, not a solved earliest qualifying age.': '資產以今日英鎊幣值表示。所列 FIRE 年齡是計畫設定的目標，並非求解出的最早達標年齡。',
  'Enter a whole stress age within the projection.': '請輸入推估期間內的整數壓力測試年齡。',
  'Unsupported': '不支援', 'Reference': '基準', 'Exceeds 95% sampling bound': '超過 95% 抽樣界限',
  'Within sampling uncertainty': '差異仍在抽樣不確定性內', 'Entered schedule': '原輸入支出時程',
  'The tested income, expenses and allocation changes do not establish a single largest improvement beyond sampling uncertainty. These are specific changes of different sizes, not universal rankings.': '已測試的收入、支出與配置調整，尚未證明有哪一項改善明確超出其他項的抽樣不確定性。這些是不同幅度的特定調整，並非通用排名。',
  'Entered plan': '原輸入計畫', 'Gross salary +£10,000/year': '稅前年薪 +£10,000／年',
  'Fixed spending −£3,000/year in all phases': '所有階段的固定支出 −£3,000／年',
  'Pension contribution to leave the top occupied tax band': '提高退休金提撥以退出目前最高所得稅級距',
  'Route future surplus to ISA, then GIA': '未來餘額先存入 ISA，再 GIA',
  'Route future surplus to GIA': '未來餘額存入 GIA', 'FIRE two years later': 'FIRE 延後兩歲',
  'Shift 10pp of bonds/cash to equities in every wrapper': '各帳戶將 10pp 債券／現金移至股票',
  'Larger deposit (£10,000) or mortgage term five years shorter': '頭期款增加 £10,000，或房貸期限縮短五年',
  'Cut would breach the retirement floor': '削減後會低於退休最低支出',
  'A wrapper has less than 10pp available outside equities': '某帳戶的股票以外配置不足 10pp',
  'Configure a property first; no property is invented': '請先設定房產；模型不會自行新增房產',
  'Configure a property first': '請先設定房產',
  'Funds the full horizon': '全期皆有資金支應', 'Funding failure': '資金不足',
  'crash 2000 style': '2000 式崩盤', 'crash 2008 style': '2008 式崩盤',
  'high inflation': '高通膨', 'lost decade': '失落十年', 'mortgage shock': '房貸衝擊',
  'property crash': '房價崩跌', 'job loss': '失業',
  'earlyEquityCrash': '退休初期股票崩盤', 'highEarlyInflation': '退休初期高通膨',
  'pre_pension_liquidity': '退休金動用前流動性不足', 'portfolio_depletion': '投資資產耗盡',
  'unfunded_essential_spending': '必要支出無法支應', 'insolvency': '資不抵債', 'mortgage_shortfall': '房貸資金不足',
  'no observations': '無觀察樣本', 'yes': '是', 'no': '否', 'Starting analysis…': '正在啟動分析…',
  'Synthetic 2000-style: equity returns −15%, −20%, −25% over three years; other years/assets use entered nominal means.': '人為設定的 2000 式情境：三年股票報酬依序為 −15%、−20%、−25%；其他年度與資產使用輸入的名目平均值。',
  'Synthetic 2008-style: one equity return of −40%; other years/assets use entered nominal means.': '人為設定的 2008 式情境：一年股票報酬為 −40%；其他年度與資產使用輸入的名目平均值。',
  'Inflation 8% for ten years; nominal asset returns stay at entered means. Salary and tax thresholds retain the model’s inflation indexing.': '十年通膨為 8%，名目資產報酬維持輸入平均值。薪資與稅務門檻沿用模型的通膨連動方式。',
  'Equity nominal returns 0% for ten years; other assets and inflation use entered means.': '股票名目報酬連續十年為 0%；其他資產與通膨使用輸入平均值。',
  'Mortgage rate 9% for three years, recast over the remaining term; contractual rate schedule resumes afterwards. No lender fees.': '房貸利率三年為 9%，依剩餘期限重算付款；之後恢復契約利率時程。不計貸款機構費用。',
  'One property return of −30%; no automatic sale or equity release.': '一年房產報酬為 −30%；不會自動售屋或釋出淨值。',
  'Salary, bonus, pensionable pay and any retirement employment are zero for one year, then resume the entered trajectory. Other income remains; no benefits or severance.': '薪資、獎金、退休金計薪基礎與退休後就業收入，一年內皆為零，之後恢復輸入的成長路徑。其他收入保留；不計福利或資遣費。',
  'Stress must start within the projection': '壓力測試必須在推估期間內開始',
  'Stress age must fall within the projection': '壓力測試年齡必須落在推估期間內',
  'Configure a property to test this stress': '請先設定房產，再執行此壓力測試',
  'Ordinary stresses require null comparison actions': '一般壓力測試的比較操作必須為 null',
  'Attribution requires ordinary runs with null actions and measureAllocation false': '結果來源分析需要一般運算：操作為 null，measureAllocation 為 false',
  'Sensitivity must preserve correlation and normal draws': '敏感度分析必須保留相關性與常態抽樣',
  'Evaluator returned a different profile': '評估器回傳的個人資料不同',
  'Evaluator changed versioned engine assumptions': '評估器改變了具版本的 engine 假設',
  'Evaluator changed ledger options': '評估器改變了帳本選項',
  'Analysis did not run the full matching path range': '分析未執行完整的配對路徑範圍',
};

export function translateAttributionTemplate(value: string, text: (value:string)=>string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Up to ([\d,]+) complete simulations, each at all ([\d,]+) entered paths, plus seven deterministic stresses\. This can take several minutes\. One worker pool serves the batch; cancellation publishes no partial analysis\.$/.exec(value))) return `最多 ${m[1]} 次完整模擬，每次使用全部 ${m[2]} 條指定路徑，另有七項固定壓力測試。可能需要數分鐘。整批共用同一個 worker pool；取消時不會發布未完成的分析。`;
  if ((m = /^(Equity nominal mean|Equity volatility|Inflation mean|Real salary growth|Property nominal growth) ([−+]\d+pp)$/.exec(value))) {
    const names: Readonly<Record<string,string>> = { 'Equity nominal mean':'股票名目平均報酬','Equity volatility':'股票波動率','Inflation mean':'平均通膨','Real salary growth':'實質薪資成長','Property nominal growth':'房產名目成長' };
    return `${names[m[1]!]} ${m[2]}`;
  }
  if ((m = /^FIRE age ([−+]\d+) years$/.exec(value))) return `FIRE 年齡 ${m[1]} 年`;
  if ((m = /^Mortgage rates ([−+]\d+pp) \(including refinances\)$/.exec(value))) return `房貸利率 ${m[1]}（含轉貸）`;
  if ((m = /^Household spending: (low|base|high) configured case$/.exec(value))) return `家庭支出：設定的${{low:'低',base:'基準',high:'高'}[m[1]!]}情境`;
  if ((m = /^Additional tax on taxable pension withdrawals: \+(\d+)pp$/.exec(value))) return `應稅退休金提領額外稅負：+${m[1]}pp`;
  if ((m = /^Configure a property first\. (.+)$/.exec(value))) return `請先設定房產。${text(m[1]!)}`;
  if ((m = /^(Lower expenses|More income|Allocation) has the largest tested improvement among income, expenses and allocation: (.+) \((.+)\)\. This ranks these specific changes, not all possible plans\.$/.exec(value))) return `${{ 'Lower expenses':'降低支出','More income':'提高收入',Allocation:'資金配置' }[m[1]!]}在已測試的收入、支出與配置調整中，改善最大：${text(m[2]!)}（${m[3]}）。此排名只適用於這些特定調整。`;
  if ((m = /^(.+)\/mo$/.exec(value))) return `${m[1]}／月`;
  if ((m = /^(pre_pension_liquidity|portfolio_depletion|unfunded_essential_spending|insolvency|mortgage_shortfall); (.+) real shortfall$/.exec(value))) return `${text(m[1]!)}；實質缺口 ${m[2]}`;
  if ((m = /^First-five-FIRE-year >20% drawdown: (yes|no); liquid assets below two years’ spending: (yes|no); observed recovery: (.+)\. Diagnostic flags are not causes\.$/.exec(value))) return `FIRE 後最初五年回落 >20%：${text(m[1]!)}；可動用資產低於兩年支出：${text(m[2]!)}；觀察到的復原時間：${text(m[3]!)}。這些風險標記不代表因果。`;
  if ((m = /^First five FIRE years: >20% financial drawdown (.+); accessible capital below two years’ spending (.+)\. Median recovery (.+), conditional on ([\d,]+) recovered paths; ([\d,]+) unrecovered\.$/.exec(value))) return `FIRE 後最初五年：金融資產回落 >20% ${m[1]}；可動用資本低於兩年支出 ${m[2]}。復原時間中位數 ${text(m[3]!)}，只計 ${m[4]} 條已復原路徑；${m[5]} 條尚未復原。`;
  if ((m = /^Present in (.+) of paths; failure when present (.+), when absent (.+)\.$/.exec(value))) return `出現在 ${m[1]} 的路徑；出現時資金不足率 ${text(m[2]!)}，未出現時 ${text(m[3]!)}。`;
  if ((m = /^(\d+)\/(\d+) cases · (.+) · ([\d,]+)\/([\d,]+) paths$/.exec(value))) return `${m[1]}／${m[2]} 個情境 · ${text(m[3]!)} · ${m[4]}／${m[5]} 條路徑`;
  return undefined;
}

export const attributionCaveatsZhTW: Readonly<Record<string,string>> = {
  "Each row changes the entered plan once and reruns the complete lifetime model. Effects interact: income changes tax and contributions, spending changes both saving and required capital, and allocation changes bridge liquidity. Do not add these effects or interpret them as shares of a causal decomposition.": "每列只調整原計畫一項，再重跑完整終身模型。各項效果會互相影響：收入改變稅負與提撥，支出同時改變儲蓄與所需資本，配置改變銜接期流動性。請勿加總這些效果，也不要將它們解讀為因果拆解的占比。",
  "All comparisons use the same seed, absolute path indices and underlying Gaussian shocks. Return sensitivities change the distribution’s moments while preserving correlation. SE describes sampling only; the displayed difference SE bound is the sum of both marginal SEs and is conservative. Findings require exceeding 1.96 times that bound.": "所有比較使用相同種子、絕對路徑索引與底層 Gaussian 衝擊。報酬敏感度會改變分布的動差，同時保留相關性。SE 只描述抽樣誤差；所顯示的差異 SE 上界為兩個邊際 SE 相加，屬於保守估計。差異必須超過此上界的 1.96 倍，才可視為明確發現。",
  "The objective here is full-plan funding success. Median terminal net worth, downside and accessible capital are different objectives; unsold property equity cannot fund spending. A larger deposit uses existing assets and a shorter mortgage term raises required payments.": "此處目標是整份計畫的資金支應成功率。期末淨資產中位數、下行結果與可動用資本是不同目標；未售房產淨值不能支應生活費。提高頭期款會使用現有資產，縮短房貸期限則會提高所需付款。",
  "Pension withdrawal tax cases add a hypothetical 5pp or 10pp charge on the taxable withdrawal only, on top of the configured tax calculation. They are assumption tests, not enacted tax changes or flat tax replacements. Volatility and FIRE age need not have a universally monotone effect.": "退休金提領稅負情境在原有稅負計算之上，只對應稅提領額外加收假設的 5pp 或 10pp。這是對假設的測試，並非已實施稅法變更，也不是改成單一稅率。波動率與 FIRE 年齡的影響不一定具有通用的單調方向。"
};
