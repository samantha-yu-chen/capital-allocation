/** Allocation display copy. Destinations and funding actions remain engine identifiers. */
export const marginalZhTW: Readonly<Record<string,string>> = {
  'Inputs changed, so the previous allocation was discarded': '輸入已變更，先前配置比較已清除',
  'No partial ranking is published.': '不會發布未完成的排名。',
  'Allocation could not be computed': '無法計算配置比較',
  'Invalid profile; no analysis can run': '資料有誤，無法執行分析',
  'The next increment': '下一筆增額資金',
  'Compare six destinations over your lifetime': '比較六種配置在一生中的結果',
  'Funding basis': '資金來源基準', 'Extra gross earnings': '額外稅前收入',
  'Existing after-tax cash': '現有稅後現金', 'Compare allocation': '比較資金配置',
  'Allocation path progress': '配置比較的路徑進度',
  'Comparison basis': '比較基準', 'What the ranking measures': '排名衡量什麼',
  'Completed allocation comparison': '配置比較已完成',
  'Ranking under your constraints': '符合限制條件下的排名',
  'Unranked': '未列入排名', 'Infeasible': '不可行', 'Dominant': '具有明確優勢',
  'Near equivalent': '表現接近', 'Assumption sensitive': '對假設敏感', 'Inferior': '表現較差',
  'Mortgage overpayment': '額外償還房貸', 'Property deposit': '房產頭期款',
  'Success change:': '成功率變化：', '(percentage points)': '（百分點）',
  'Mean usable wealth:': '可用資產平均值：', 'Change:': '變化：',
  'Mean terminal:': '期末平均值：', 'Observed worst terminal:': '觀察到的最差期末值：',
  'Median terminal:': '期末中位數：', 'P10 terminal:': '期末 P10：',
  'Mean lifetime tax:': '全期稅負平均值：', 'Mean maximum debt:': '最高債務平均值：',
  'Mean usable / Δ': '可用資產平均值／Δ', 'Median accessible / Δ': '可動用資產中位數／Δ',
  'Median net worth / Δ': '淨資產中位數／Δ', 'Mean debt / Δ': '債務平均值／Δ',
  'Tax boundaries': '稅務門檻',
  'Thresholds from the selected tax configuration': '所選稅制的門檻',
  'These are tax-basis thresholds, not gross salary bands. Crossed boundaries for the expected-value first year appear in each funding audit above.': '這些門檻以各自的課稅基礎計算，並非稅前薪資級距。期望值第一年跨越的門檻，列於上方各項資金明細。',
  'Boundary': '門檻', 'Income basis': '所得基礎', 'Threshold': '門檻金額',
  'Reproducibility metadata': '可重現性中繼資料',
  'No destination clears all constraints on these sampled paths. No allocation recommendation is supported. Review the probability, reserve, liquidity and debt reasons below.': '在這些抽樣路徑中，沒有配置符合全部限制，因此不足以支持任何配置建議。請查看下方成功率、準備金、流動性與債務的原因。',
  'FIRE target not cleared by the 95% sampling lower bound.': '95% 抽樣下界未達 FIRE 目標。',
  'Minimum liquid-years threshold breached on at least one sampled path.': '至少一條抽樣路徑未符合最低流動性年數。',
  'Emergency cash reserve breached on at least one sampled path.': '至少一條抽樣路徑未符合緊急現金準備金要求。',
  'Maximum acceptable real debt exceeded on at least one sampled path.': '至少一條抽樣路徑超過可接受的實質債務上限。',
  'The full increment cannot enter pension within member eligibility, relevant earnings, retained pay and annual allowance limits.': '受個人資格、相關工作所得、保留薪資與年度額度限制，無法將整筆增額資金存入退休金。',
  'Extra earnings leave no positive settled cash to allocate.': '額外收入結算後沒有正數現金可供配置。',
  'The increment exceeds existing opening cash; no implicit sale of ISA/GIA is assumed.': '增額資金超過期初現有現金；模型不會自行出售 ISA／GIA。',
  'A property deposit requires a configured planned purchase.': '房產頭期款配置需要先設定購屋計畫。',
  'The full increment exceeds the additional deposit capacity.': '整筆增額資金超過可增加的頭期款額度。',
  'Mortgage overpayment requires an existing owned property with debt.': '額外償還房貸需要已持有且仍有貸款的房產。',
  'The full increment exceeds the remaining mortgage.': '整筆增額資金超過剩餘房貸。',
  'The full allocation cannot be funded alongside the current year obligations.': '支付本年度義務後，無法支應整筆配置。',
  'The allocation would leave cash below the current emergency reserve.': '此配置會使現金低於目前緊急準備金要求。',
  'The full increment exceeds remaining ISA subscription capacity.': '整筆增額資金超過剩餘 ISA 存入額度。',
  'Taxable non-savings income': '應稅非儲蓄所得', 'Adjusted net income': '調整後淨所得',
  'Employment after sacrifice': 'Salary sacrifice 後就業所得',
  'Threshold income': '門檻所得', 'Adjusted income': '調整後所得',
  'Personal allowance taper': '個人免稅額遞減', 'Personal allowance taper starts': '個人免稅額開始遞減',
  'Personal allowance fully tapered': '個人免稅額完全遞減',
  'NI primary threshold': 'NI 起徵門檻', 'NI upper earnings limit': 'NI 工作所得上限',
  'Pension taper threshold test': '退休金額度遞減的門檻所得檢查',
  'Pension taper adjusted test': '退休金額度遞減的調整後所得檢查',
  'baseline': '基準計畫', 'pension': '退休金', 'isa': 'ISA', 'gia': 'GIA',
  'cash': '現金', 'mortgage': '額外償還房貸', 'deposit': '頭期款',
  'Marginal candidates must share the seed, market assumptions and absolute path indices.': '增額配置候選方案必須使用相同種子、市場假設與絕對路徑索引。',
  'Allocation audit samples missing': '缺少配置檢查樣本',
  'Marginal comparison requires rentInvestment and incoming marginalAction null.': '增額比較的 rentInvestment 與傳入 marginalAction 必須為 null。',
};

const bandNames: Readonly<Record<string,string>> = {
  starter: '入門', basic: '基本', intermediate: '中間', higher: '較高', advanced: '進階', top: '最高', additional: '附加',
};
export function translateMarginalTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Rank (\d+)$/.exec(value))) return `第 ${m[1]} 名`;
  if ((m = /^(.+): target ages, today’s money$/.exec(value))) return `${text(m[1]!)}：目標年齡，今日幣值`;
  if ((m = /^Up to 7 complete simulations: ([\d,]+) lifetime projections at ([\d,]+) paths per plan\. This can take a minute or more\. The path count is never reduced; you can lower it explicitly before running\.$/.exec(value))) return `最多 7 次完整模擬：共 ${m[1]} 個完整人生推估，每個計畫 ${m[2]} 條路徑。可能需要一分鐘以上。系統不會自行減少路徑數；你可以在執行前手動調低。`;
  if ((m = /^(.+): ([\d,]+) of up to ([\d,]+) plans complete$/.exec(value))) return `${text(m[1]!)}：已完成 ${m[2]} 個計畫，最多 ${m[3]} 個`;
  if ((m = /^Destination cash (.+); pension added (.+)\.$/.exec(value))) return `配置現金 ${m[1]}；新增退休金 ${m[2]}。`;
  if ((m = /^Incremental income tax (.+); employee NI (.+); employer pension (.+); provider relief (.+)\.$/.exec(value))) return `新增所得稅 ${m[1]}；員工 NI ${m[2]}；雇主退休金 ${m[3]}；機構補入稅務減免 ${m[4]}。`;
  if ((m = /^(.+) crossed at (.+) \((.+) → (.+) on that tax basis\)\.$/.exec(value))) return `${text(m[1]!)}跨越 ${m[2]}（該課稅基礎由 ${m[3]} → ${m[4]}）。`;
  if ((m = /^(.+) (band ceiling|taxable band)$/.exec(value))) {
    const name = bandNames[m[1]!.toLowerCase()];
    if (name) return `${name}${m[2] === 'band ceiling' ? '級距上限' : '應稅級距'}`;
  }
  if ((m = /^(.+) has the highest tested constrained mean usable wealth\. Shared ranks indicate near-equivalence within paired sampling uncertainty, not a universal wrapper ordering\. Read the tradeoffs before acting\.$/.exec(value))) return `${m[1]!.split(' / ').map(text).join('／')}在已測試且符合限制的方案中，可用資產平均值最高。並列名次代表差異落在配對抽樣不確定性內，不代表通用的帳戶優先順序。採取行動前請先了解各項取捨。`;
  return undefined;
}

export const marginalBasisZhTW: Readonly<Record<string,string>> = {
  "Gross earnings: a one-off non-pensionable bonus. Pension uses the selected workplace method, remaining contractual employer match and NI shareback. Existing after-tax cash: a transfer from opening cash; pension uses RAS with additional relief claimed and recycled in the same annual settlement. No employer match is invented for existing cash.": "稅前收入：一次性且不計入退休金基礎的獎金。退休金採用所選職場提撥方式、契約剩餘雇主配比與 NI 回補。現有稅後現金：從期初現金轉入；退休金使用 RAS，額外減免在同年度結算中申請並再投入。現有現金不會憑空獲得雇主配比。",
  "Every plan reuses the profile seed and absolute path indices, the fixed spending policy and full lifetime ledger. Rent-investment actions are null. The baseline is the entered plan: for existing cash it already owns the increment; for gross earnings it does not receive the bonus.": "每個計畫重用個人資料的種子與絕對路徑索引、固定支出政策及完整終身帳本。租屋投資操作為 null。基準為原先輸入的計畫：若資金來自現有現金，基準已持有這筆錢；若來自稅前收入，基準不會收到獎金。",
  "Objective: equal-weight mean after-tax usable wealth at FIRE, pension access (if in horizon) and terminal age. Snapshot valuation liquidates financial assets in one tax year with no employment or contributions, plus configured other/state-pension income. It uses actual GIA basis/losses and remaining pension tax-free allowance. Pension is excluded before access; unsold property equity is excluded. Debt is a separate hard constraint.": "目標：將 FIRE、退休金可動用年齡（若在推估範圍內）及期末年齡的稅後可用資產平均值等權加總。各時點估值假設在一個稅務年度內變現金融資產，沒有就業收入或提撥，但包含設定的其他收入與 State Pension。使用實際 GIA 成本基礎、損失及剩餘退休金免稅額度。退休金在可動用前不計入，未售房產淨值也不計入。債務為獨立的硬性限制。",
  "Constraints: the 95% sampling lower bound clears the FIRE target; emergency cash reserve and minimum liquid years hold throughout every sampled path; real debt stays within the entered ceiling. These are sampled checks, not guarantees. Unranked evaluated plans still show real outcomes.": "限制：95% 抽樣下界須達到 FIRE 目標；每條抽樣路徑全期均須符合緊急現金準備金與最低流動性年數；實質債務須在輸入上限內。這些是抽樣檢查，並非保證。已評估但未列入排名的計畫，仍會呈現實際結果。",
  "All changes are versus the baseline in today’s money. ± is a 95% Monte Carlo sampling interval; paired errors use matching paths. Terminal wealth and P10 include unsold property and unrealised taxes and do not define the usable-wealth objective. Funding audit uses the expected-value first year; each sampled path settles its own taxes.": "所有變化皆相對基準，以今日幣值表示。± 為 95% Monte Carlo 抽樣區間；配對誤差使用相同路徑。期末資產與 P10 包含未售房產及尚未實現的稅負，並非可用資產目標的定義。資金明細使用期望值第一年；每條抽樣路徑會各自結算稅負。",
  "Assumption sensitivity: one-year liquidation can tax pension more heavily than phased drawdown; earlier FIRE increases the value of accessible bridge capital. Returns, future tax policy, withdrawal timing and mortgage rates can change the ordering. These are conditional tradeoffs, not separately simulated sensitivity forecasts. Dominance requires a material probability and objective advantage with no worse downside, accessible capital or debt.": "對假設的敏感性：單年度變現可能比逐年提領承擔更高退休金稅負；提早 FIRE 會提高銜接期可動用資本的價值。報酬、未來稅制、提領時點與房貸利率都可能改變排序。這些是有條件的取捨說明，並未另行執行敏感度預測。明確優勢要求成功率與目標值有實質改善，且下行結果、可動用資本與債務都不較差。",
  "Property deposit increases the deposit on the configured purchase at the same price, with unchanged transaction costs. Until a future purchase the budget remains ordinary cash and may be used by the plan; failure to fund the eventual purchase is recorded. Mortgage overpayment uses existing debt, no lender fees or early-repayment penalties, and recasts payments over the original remaining term.": "房產頭期款配置會在購屋價格與交易成本不變下，提高已設定購屋的頭期款。未來購屋前，這筆預算仍為一般現金，可供計畫使用；最終無法支付購屋資金時會記錄不足。額外償還房貸使用既有債務，不計貸款機構費用或提前清償違約金，並依原剩餘期限重新計算付款。"
};
