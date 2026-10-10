export const profileZhTW: Readonly<Record<string, string>> = {
  'Optional overrides for a half-open age range. A phase wins over the current/retirement schedule. Phases must not overlap.': '可選擇覆寫特定年齡區間的支出，包含起始年齡但不含結束年齡。階段設定優先於目前／退休支出時程，不同階段不可重疊。',
  'Add spending phase': '新增支出階段',
  'One-off amounts in today’s money, funded in the year they fall. Living costs take priority if both cannot be met.': '以今日幣值表示的一次性支出，在指定年度支應。若無法同時支付，生活費優先。',
  'Label': '名稱', 'Remove': '移除', 'Add capital need': '新增大額支出',
  'These are the correlations of the underlying Gaussian log-growth shocks,': '此處設定的是底層 Gaussian 對數成長衝擊的相關性，',
  'not': '而非', 'the Pearson correlation of arithmetic returns. For non-zero log volatilities the implied arithmetic correlation is': '算術報酬的 Pearson 相關性。對數波動率非零時，對應的算術相關性為',
  '. The matrix must be symmetric, have a unit diagonal and be positive semidefinite; a correlation involving a zero-volatility series has no observable effect on that series.': '。矩陣必須對稱、對角線皆為 1，且為半正定；與零波動序列相關的係數不會對該序列產生可觀察的影響。',
  'Upper triangle is editable; the mirror cell is written with it.': '可編輯上三角區域，對稱位置會同步更新。',
  'shock': '衝擊',
  'A fixed order, applied every year. Cash is the settlement account, so its position controls how much of the opening cash balance is released before the other accounts are liquidated.': '每年都使用相同的固定順序。現金是結算帳戶，其順位會決定在變現其他帳戶前，先動用多少期初現金。',
  'A purchase uses its price and deposit; existing value and debt apply only to an already owned property. First-time relief and additional-dwelling eligibility are your explicit assumptions. Owner-occupied sales assume full private residence relief. No automatic equity release.': '購屋使用購買價格與頭期款；目前價值與負債只適用於已持有的房產。首次購屋減免與額外住宅資格由你明確確認。自住房出售假設可享完整 private residence relief。模型不會自動釋出房產淨值。',
  'Add refinance rate': '新增轉貸利率', 'Dismiss': '關閉', 'needs attention': '需要修正',
  'A value you changed is marked': '你修改的數值會標示為',
  'and can be put back on its own, or a whole section at a time.': '，可以單獨還原，也可以一次還原整個區塊。',
  'off': '關閉', 'on': '開啟', 'nothing set': '尚未設定', 'as supplied': '依輸入資料',
};

export function translateProfileTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^The default is (.+)\.$/.exec(value))) return `預設值依據：${text(m[1]!)}。`;
  if ((m = /^Remove phase (\d+)$/.exec(value))) return `移除第 ${m[1]} 階段`;
  if ((m = /^Remove refinance (\d+)$/.exec(value))) return `移除第 ${m[1]} 次轉貸`;
  if ((m = /^Move (cash|isa|gia|pension) (earlier|later)$/.exec(value))) return `將 ${text(m[1] === 'pension' ? 'Workplace pension' : m[1] === 'cash' ? 'Cash' : m[1]!.toUpperCase())}往${m[2] === 'earlier' ? '前' : '後'}移`;
  if ((m = /^Hiding an input changes nothing: every value stays exactly as it is and the model uses all of them\. Anything that needs attention is shown whichever setting you pick\. Showing (\d+) inputs?\.$/.exec(value))) return `隱藏欄位只影響顯示；所有數值保持不變，模型仍會使用完整資料。不論選擇哪種顯示方式，需要修正的項目都會顯示。目前顯示 ${m[1]} 個欄位。`;
  if ((m = /^Every one of these (\d+) values is still the starter profile’s\.$/.exec(value))) return `這 ${m[1]} 個數值目前全數沿用起始情境。`;
  if ((m = /^(\d+) of (\d+) values (?:is|are) yours; the rest are the starter profile’s\.$/.exec(value))) return `${m[2]} 個數值中，${m[1]} 個由你修改，其餘沿用起始情境。`;
  if ((m = /^Reset (.+) \((\d+) values?\) to the default$/.exec(value))) return `將「${text(m[1]!)}」的 ${m[2]} 個數值還原為預設值`;
  if ((m = /^“(.+)” is under (.+), and it is now focused\.$/.exec(value))) return `「${text(m[1]!)}」位於「${text(m[2]!)}」，已將焦點移到該欄位。`;
  if ((m = /^Detail raised to “(.+)” so that “(.+)” is on screen\. Nothing about your plan changed: which inputs are shown is a display setting, and you can set it back above\.$/.exec(value))) return `已將顯示細節調整為「${text(m[1]!)}」，讓「${text(m[2]!)}」出現在畫面上。計畫內容未改變；欄位顯示方式只是介面設定，可在上方改回。`;
  if ((m = /^Reset (.+) to the default (.+)$/.exec(value))) return `將「${text(m[1]!)}」還原為預設值 ${text(m[2]!)}`;
  if ((m = /^(.+) has no default$/.exec(value))) return `「${text(m[1]!)}」沒有預設值`;
  if ((m = /^(.+) is yours: the starter profile has no value for it, so there is nothing to reset it to\.$/.exec(value))) return `「${text(m[1]!)}」是你新增的資料，起始情境沒有對應值，因此無法還原。`;
  if ((m = /^(.+) is yours\. The starter profile’s value is (.+?)\.(?: The default is (.+)\.)?$/.exec(value))) return `「${text(m[1]!)}」已由你修改。起始情境的數值為 ${text(m[2]!)}。${m[3] ? `預設值依據：${text(m[3]!)}。` : ''}`;
  if ((m = /^(.+) is the starter profile’s value, (.+?), not something you entered\.(?: The default is (.+)\.)?$/.exec(value))) return `「${text(m[1]!)}」沿用起始情境的數值 ${text(m[2]!)}，尚未由你輸入。${m[3] ? `預設值依據：${text(m[3]!)}。` : ''}`;
  if ((m = /^age (\d+)$/.exec(value))) return `${m[1]} 歲`;
  if ((m = /^(£[\d,.]+) a month$/.exec(value))) return `${m[1]}／月`;
  if ((m = /^(\d+) entered$/.exec(value))) return `已輸入 ${m[1]} 筆`;
  return undefined;
}
