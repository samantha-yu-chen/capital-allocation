export const errorsZhTW: Readonly<Record<string, string>> = {
  "Your floor spending should be at most your target, and comfort at least your target — floor is the least you could live on, comfort is the most you’d like. Change whichever of the three is out of line.": "最低支出應不高於目標支出，舒適支出應不低於目標支出。最低值代表最精簡的生活預算，舒適值代表希望負擔得起的較寬裕生活。請調整不符合順序的項目。",
  "The shares held in this account have to add up to exactly 100%. Every pound is in one of equities, bonds or cash, so the three figures are a split of the whole, not three separate amounts.": "此帳戶的配置比例必須剛好加總為 100%。每一英鎊都配置在股票、債券或現金之一，因此這三項是同一總額的分配。",
  "These three ages have to run in order: your age now, then the age you stop relying on a salary, then the age the projection stops. The last one has to be later than the middle one, not equal to it.": "這三個年齡必須依序排列：目前年齡、停止依賴薪資的年齡、推估結束年齡。最後一項必須晚於中間一項，不能相同。",
  "The shared, per-adult and per-child amounts have to add back up to your current monthly spending. The household total is the figure the model uses; the breakdown only explains how it divides up.": "共同支出、每位成人與每位子女支出，必須加總回目前家庭月支出。模型以家庭總額計算，明細只用來說明分配。",
  "The low, base and high spending cases have to be in that order, lowest first.": "低、基準與高支出情境必須由低到高排列。",
  "The rent inside your spending cannot be more than your whole monthly spending. Enter only the rent part of the totals you gave above.": "支出中包含的房租不能超過整體月支出。請只填入上方總額中的房租部分。",
  "Each spending phase needs an end age later than its start age, and two phases cannot cover the same year. A phase runs from its start age up to, but not including, its end age.": "每個支出階段的結束年齡必須晚於開始年齡，且不同階段不能涵蓋同一年。階段包含開始年齡，但不包含結束年齡。",
  "These figures do not describe a set of markets that could actually exist together. Usually one value is too strong: if two things both move closely with a third, they cannot move opposite ways to each other. Move the largest numbers back towards zero.": "這組數字無法構成一致的市場相關性。通常是某個相關係數過強：若兩項都與第三項密切同向，就不能彼此強烈反向。請將最大的數值往 0 調整。",
  "The withdrawal order has to list each of the four accounts exactly once.": "提領順序必須將四個帳戶各列出一次。",
  "Salary sacrifice is chosen as the contribution method but marked as not offered by your employer. Either tick that it is available or pick another method.": "提撥方式選擇了 salary sacrifice，但雇主設定為未提供。請勾選雇主提供此方案，或改用其他提撥方式。",
  "The purchase age has to fall between your age now and the end of the projection. For a home you already own, untick \"plan a purchase\" and enter its value and mortgage instead.": "購屋年齡必須落在目前年齡到推估結束之間。若房產已持有，請取消「規劃購屋」，改填目前價值與房貸。",
  "The sale has to happen after you own the property and before the projection ends.": "必須在已持有房產之後、推估結束之前售屋。",
  "Two refinances cannot fall at the same age. Give each one its own year.": "兩次轉貸不能在同一個年齡發生，請分別設定不同年度。",
  "A refinance cannot happen before you own the property.": "轉貸不能早於持有房產的時間。",
  "To work out the tax on selling a rental you already own, the model needs what you originally paid for it. Enter the acquisition cost basis.": "若要計算既有出租房產的售屋稅負，模型需要原始購買成本。請填入取得成本基礎。",
  "First-time buyer relief only applies to a home you will live in, not to a rental.": "首次購屋減免只適用於自住住宅，不適用於出租房產。",
  "You chose to enter the purchase tax yourself, so the model needs the amount. There is no default for it, because it depends on rules this app does not hold.": "你選擇手動輸入購屋稅，因此必須填入金額。此項取決於 app 未設定的稅制，沒有預設值。",
  "The deposit cannot be more than the purchase price.": "頭期款不能超過購屋價格。",
  'Salary sacrifice exceeds available earnings or the supplied retained-pay floor': 'Salary sacrifice 超過可用工作所得，或不符合設定的最低保留薪資',
  'Relievable member contributions are not supported at age 75 or above': '模型不支援 75 歲以上可享稅務減免的個人提撥',
  'Member contributions exceed relevant earnings / the relief-at-source minimum': '個人提撥超過相關工作所得／relief at source 最低額度'

};

export function translateErrorTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Too small: expected number to be (>=|>)(.+)$/.exec(value))) return `數值必須${m[1] === '>=' ? '大於或等於' : '大於'} ${m[2]}。`;
  if ((m = /^Too big: expected number to be (<=|<)(.+)$/.exec(value))) return `數值必須${m[1] === '<=' ? '小於或等於' : '小於'} ${m[2]}。`;
  if (value === 'Invalid input: expected number, received NaN' || value === 'Invalid input: expected number, received number') return '請輸入有效的有限數值。';
  if ((m = /^(PensionLimitError|RangeError|MarginalInfeasibleError): (.+)$/.exec(value))) return `${m[1]}：${text(m[2]!)}`;
  if ((m = /^Age (\d+): (.+)$/.exec(value))) return `${m[1]} 歲：${text(m[2]!)}`;
  if ((m = /^Pension input exceeds available allowance by (£[\d,.]+); excess-charge modelling is not supported$/.exec(value))) return `退休金提撥超過可用額度 ${m[1]}；模型不支援超額提撥的額外稅負`;

  if ((m = /^(.+) needs a number\. The box is empty or holds something that is not one, and nothing is assumed on your behalf — the model waits rather than quietly using the previous value\.$/.exec(value))) return `${text(m[1]!)}需要填入數字。欄位目前空白或內容無法辨識為數字；模型會等待你修正，不會自行假設或沿用先前的數值。`;
  if ((m = /^(.+) cannot be negative\. Enter 0 if there is none\.$/.exec(value))) return `${text(m[1]!)}不能為負數。若沒有此項，請填 0。`;
  if ((m = /^(.+) has to be at least (.+)\.$/.exec(value))) return `${text(m[1]!)}必須至少為 ${m[2]}。`;
  if ((m = /^(.+) cannot be below (.+)\.$/.exec(value))) return `${text(m[1]!)}不能低於 ${m[2]}。`;
  if ((m = /^(.+) has to be more than (.+)\.$/.exec(value))) return `${text(m[1]!)}必須大於 ${m[2]}。`;
  if ((m = /^(.+) cannot be more than (.+)\.$/.exec(value))) return `${text(m[1]!)}不能超過 ${m[2]}。`;
  if ((m = /^(.+) has to be less than (.+)\.$/.exec(value))) return `${text(m[1]!)}必須小於 ${m[2]}。`;
  if ((m = /^(.+) has to be a whole number\.$/.exec(value))) return `${text(m[1]!)}必須為整數。`;
  return undefined;
}
