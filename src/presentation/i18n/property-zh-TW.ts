/** Property UI copy; GBP values, jurisdiction and calculations remain unchanged. */
export const propertyZhTW: Readonly<Record<string,string>> = {
  'Correct the property or profile inputs to project': '請先修正房產或個人資料，再進行推估',
  'Rent-and-invest requires a planned purchase; existing ownership has no unspent deposit': '租屋投資比較需要規劃購屋；既有持有者沒有尚未支付的頭期款',
  'Invalid mortgage': '房貸設定有誤',
  'Projection unavailable': '無法進行推估',
  'Add a property to model ownership': '新增房產以模擬持有情況',
  'Enable the property above to plan a purchase or enter an existing home.': '請在上方啟用房產，規劃購屋或輸入已持有的住宅。',
  'Starting property equity': '起始房產淨值',
  'Separate from spendable capital. Purchase figures describe the proposed transaction.': '與可支出資本分開呈現。購屋數字描述預計交易。',
  'Starting LTV': '起始 LTV', 'No property value': '無房產價值',
  'Debt-service coverage': '債務償付覆蓋倍數', 'No debt service': '無債務償付',
  'Operating rental income / scheduled debt service, before personal tax.': '租金營業淨收入／預定債務償付，尚未扣除個人稅負。',
  'Net household income after non-mortgage spending / scheduled debt service. Assets can fund a shortfall.': '扣除房貸以外支出後的家庭淨收入／預定債務償付。資產可用來補足缺口。',
  'This deterministic plan has funding failures': '此固定路徑計畫出現資金不足',
  'Ownership cash flow': '持有房產的現金流', 'First ownership year': '持有房產第一年',
  'Ownership starts at age': '開始持有年齡',
  'Scheduled monthly mortgage payment': '預定每月房貸付款',
  'Purchase tax (today’s GBP)': '購屋稅（今日英鎊幣值）',
  'Purchase funding actually paid': '實際支付的購屋資金',
  'Housing cash outflow / year': '每年住房現金流出',
  'Housing economic cost / year': '每年住房經濟成本',
  'Rental cash flow before personal tax': '個人稅負前的租金現金流',
  'Cash outflow includes principal; economic cost excludes it because repayment builds equity. These annual figures exclude purchase/sale costs, shown separately in the ledger. Mortgage payments are additional to the rent-adjusted living budget, counted once. Interest-only loans require a balloon at term.': '現金流出包含本金；經濟成本則排除本金，因為還款會累積房產淨值。這些年度數字不含另列於帳本的買賣成本。房貸付款在已扣除房租的生活預算之外另計，僅計入一次。只繳息貸款須於到期時一次償還本金。',
  'Leverage': '槓桿', 'Downside before financing and costs': '融資與成本前的下行影響',
  'Expected first-year appreciation': '預期第一年增值',
  'Maximum equity drawdown on the deterministic path': '固定路徑中的最大房產淨值回落',
  'Purchase not funded': '購屋資金不足',
  'Gross return on starting equity': '起始房產淨值的毛報酬率',
  'Not meaningful with nonpositive equity': '淨值不為正數，無法有效解讀',
  'Price shock': '價格衝擊', 'Equity change': '淨值變化', 'Remaining equity': '剩餘淨值',
  'Instantaneous value shocks hold debt fixed. They are leverage illustrations; the full projections below include financing, cash flow and taxes.': '即時價值衝擊假設債務固定，用來說明槓桿效果。下方完整推估則包含融資、現金流與稅負。',
  'Mortgage environments': '房貸利率情境',
  '3 / 5 / 7 / 9% over the full plan': '整份計畫採用 3／5／7／9% 利率',
  'Each scenario replaces the initial rate and all refinance changes with a constant rate. Expected market returns are used; deterministic funding success is not a probability.': '各情境以固定利率替換起始利率與所有轉貸變更。市場採用預期報酬；固定路徑有資金支應，不代表成功機率。',
  'Rate': '利率', 'First annual debt service': '第一年債務償付',
  'Terminal net worth': '期末淨資產', 'Full-plan funding': '全期資金支應', 'Funded': '有資金支應',
  'Matched market paths': '配對市場路徑',
  'Rental purchase versus invest': '購買出租房產與投資比較',
  'Buy versus rent and invest': '購屋與租屋投資比較',
  'Both plans start with the same financial assets, spending schedules, salary, seed and path count. At the purchase age, the alternative invests the avoided deposit and costs from available cash into remaining ISA allowance then GIA, preserving its reserve. Holdings already invested stay invested. The rent component remains in its spending. No equity is released without a scheduled sale. All results cover the full horizon in today’s GBP.': '兩個計畫使用相同起始金融資產、支出時程、薪資、種子與路徑數。到購屋年齡時，替代方案將省下的頭期款與費用，從可用現金依剩餘 ISA 額度、再 GIA 的順序投資，並保留準備金。原本的投資繼續持有，支出也繼續包含房租。未安排售屋就不會釋出房產淨值。所有結果涵蓋完整推估期間，以今日英鎊幣值表示。',
  'A planned purchase is required for this comparison. An existing owner has no unspent deposit; enter a purchase scenario to compare acquisition choices.': '此比較需要規劃購屋。已持有房產的人沒有尚未支付的頭期款；請輸入購屋情境，以比較取得房產的選擇。',
  'Cancel comparison': '取消比較',
  'Comparison cancelled; no partial results.': '比較已取消，不會發布未完成的結果。',
  'Full-plan measure': '全期衡量指標', 'Buy': '購屋', 'Rent + invest': '租屋＋投資',
  'Drawdown is the largest decline in real net worth from its running peak over the full horizon; cash flows and sale costs contribute. Debt exposure includes the opening mortgage. Distributions describe sampled paths, not bounds.': '回落代表整段推估期間中，實質淨資產相對先前高點的最大跌幅；現金流與售屋成本也會影響它。債務曝險包含期初房貸。分布描述本次抽樣路徑，並非結果上下限。',
  'Comparison reproducibility': '比較重現資訊',
  'Annual property ledger': '年度房產帳本', 'Value, debt and cash flow': '價值、債務與現金流',
  'Rows cover [age, age+1). Value, debt and equity are closing balances; flows occur before market returns. All numbers are today’s GBP. Personal rental income tax is assessed jointly with other income in the Overview ledger; finance relief is shown here.': '每列涵蓋 [年齡, 年齡+1)。價值、債務與淨值為期末餘額；現金流先結算，再套用市場報酬。所有數字均為今日英鎊幣值。個人租金所得稅在總覽帳本中與其他收入合併計算；融資稅負減免則列於此處。',
  'Value': '價值', 'Debt': '債務', 'Equity': '淨值', 'Rent': '租金', 'Interest': '利息',
  'Principal paid': '已償本金', 'Operating costs': '營運成本', 'Transaction cash': '交易現金流',
  'Finance tax relief': '融資稅負減免', 'Plan shortfall': '計畫資金缺口',
  'FIRE success': 'FIRE 成功率',
  'Median terminal liquid capital': '期末可動用資本中位數',
  'P10 lifetime minimum liquid capital': '全期最低可動用資本 P10',
  'P90 maximum net-worth drawdown': '最大淨資產回落 P90',
  'P90 maximum mortgage debt': '最高房貸債務 P90',
  'Mortgage shortfall probability': '房貸資金不足機率',
};

export function translatePropertyTemplate(value: string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^First failure at age (\d+)\. Property equity cannot automatically pay bills\. See the Overview ledger and run FIRE & Monte Carlo for sampled success\.$/.exec(value))) return `首次資金不足為 ${m[1]} 歲。房產淨值不能自動支付帳單。請查看總覽帳本，並執行 FIRE 與 Monte Carlo 以取得抽樣成功率。`;
  if ((m = /^Failure at age (\d+)$/.exec(value))) return `${m[1]} 歲時資金不足`;
  if ((m = /^Compare ([\d,]+) matching paths$/.exec(value))) return `比較 ${m[1]} 組配對路徑`;
  if ((m = /^([\d,]+) \/ ([\d,]+) path pairs$/.exec(value))) return `${m[1]}／${m[2]} 組路徑配對`;
  if ((m = /^Terminal net worth — (mean|median|p10|p90)$/.exec(value))) return `期末淨資產 — ${{mean:'平均值',median:'中位數',p10:'P10',p90:'P90'}[m[1]!]}`;
  return undefined;
}
