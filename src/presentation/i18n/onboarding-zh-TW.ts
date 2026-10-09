export const onboardingZhTW: Readonly<Record<string, string>> = {
  'About you': '關於你', 'What you have': '現有資產', 'See your result': '查看結果',
  'Start from a situation like yours, then set the dates and tax region that shape the plan.': '從接近你的情境開始，再設定影響計畫的年齡與所得稅地區。',
  'Add the pay and pension contributions you can rely on.': '填入可預期的薪資與退休金提撥。',
  'Separate the bills you must pay from the life you choose.': '分開填寫必要開銷與可自行決定的生活支出。',
  'Add the accounts that will fund the plan.': '填入將支應計畫的各帳戶資產。',
  'Start with transparent arithmetic, then test the plan properly.': '先看清楚參考計算，再完整測試計畫。',
  'Start here steps': '入門步驟', 'Some answers still need attention': '部分回答仍需修正',
  'Go back to the highlighted step and fix the field message before viewing a result.': '請回到標示的步驟，依欄位訊息修正資料後再查看結果。',
  'Reference FIRE number': 'FIRE 參考資本', 'Reference FIRE target': 'FIRE 參考目標',
  'Retirement spending ÷ the reference withdrawal rate.': '退休年支出 ÷ 參考提領率。',
  'One deterministic path using the configured average returns. It is not a probability or forecast.': '使用已設定的平均報酬，計算一條固定路徑。這不是成功率，也不是預測。',
  'Two numbers, one answer': '兩個數字，如何判讀',
  'The single reference path funds every year': '單一參考路徑可支應每年支出',
  'The single reference path has a shortfall': '單一參考路徑有資金缺口',
  'This is a useful first check, but one smooth path cannot tell you whether the plan is safe.': '這是有用的初步檢查，但一條平順路徑無法判斷計畫是否安全。',
  'Running…': '執行中…', 'Cancel': '取消', 'See the full FIRE result': '查看完整 FIRE 結果',
  'Simulation progress': '模擬進度', 'Run cancelled': '已取消執行',
  'No partial probability is published.': '不會顯示未完成的成功率。', 'The simulation failed': '模擬執行失敗',
  'Your plan succeeded in': '你的計畫成功率為',
  'A first personal result in five steps': '五個步驟，取得第一份個人結果',
  'Build the outline of your plan': '建立計畫輪廓',
  'Pick a starting situation if one looks like yours, then use the figures you know. Everything else keeps the visible starter default and remains editable in Overview.': '若有接近你的起始情境，可以先選用，再填入你知道的數字。其他項目保留畫面上可見的起始值，之後仍可在總覽修改。',
  'Dismiss start here': '關閉入門引導', 'Fix this step before continuing': '請先修正這個步驟再繼續',
  'Your employer contribution is money your employer adds. If they match what you pay, enter the rate they actually add here.': '雇主提撥是雇主額外投入的資金。若採配比提撥，請在此填入雇主實際加提的比例。',
  'Use my current spending for retirement': '退休支出沿用目前支出', 'Back': '上一步', 'Continue': '繼續',
  'People like me': '接近我的情境', 'Start from a situation that looks like yours': '從接近你的情境開始',
  'Why these figures': '這些數字的設定依據', 'Chosen — start again from it': '已選用；重新從此情境開始',
  'Age now': '目前年齡', 'Spending now': '目前支出', 'Retirement spending': '退休支出',
  'Cash, ISA and GIA': '現金、ISA 與 GIA', 'Pension and SIPP': '職場退休金與 SIPP',
  'You pay in': '你的提撥', 'Employer pays in': '雇主提撥', 'Property': '房產',
  'Rest of the UK': '英國其他地區', 'None': '無', 'None in the plan': '計畫未納入房產',
  'your household': '家庭成員', 'your salary': '薪資', 'your spending': '支出',
  'the age you want to stop': '希望停止工作的年齡', 'This value': '此數值',
  'Which of these two numbers says whether my plan works?': '這兩個數字，哪個用來判斷計畫是否可行？',
  'The FIRE number is a landmark': 'FIRE 參考資本是規模參考',
  'The success probability is the verdict': '成功率才是達標判斷依據',
};

/** Anchored authored templates keep money, ages, rates and path counts unchanged. */
export function translateOnboardingTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Projected wealth at FIRE age (\d+)$/.exec(value))) return `${m[1]} 歲 FIRE 時的推估資產`;
  if ((m = /^Its first funding failure is at age (\d+|unknown)\. A market simulation tests many possible paths\.$/.exec(value))) return `首次資金不足發生於 ${m[1] === 'unknown' ? '未知年齡' : `${m[1]} 歲`}。市場模擬會測試許多可能的路徑。`;
  if ((m = /^Now test the plan across ([\d,]+) possible futures$/.exec(value))) return `現在用 ${m[1]} 個可能的未來測試計畫`;
  if ((m = /^Run ([\d,]+) paths$/.exec(value))) return `執行 ${m[1]} 條路徑`;
  if ((m = /^This is the real safety test\. It runs exactly ([\d,]+) paths with the same profile used by the FIRE & Monte Carlo tab\. It starts only when you press the button\.$/.exec(value))) return `這是完整的安全性測試。使用與 FIRE 與 Monte Carlo 頁面相同的個人資料，執行 ${m[1]} 條路徑。只有按下按鈕後才會開始。`;
  if ((m = /^of the ([\d,]+) simulated futures\.$/.exec(value))) return `（共模擬 ${m[1]} 個未來）。`;
  if ((m = /^Step (\d+) of (\d+)$/.exec(value))) return `第 ${m[1]} 步，共 ${m[2]} 步`;
  if ((m = /^(\d+) adults?(?:, (\d+) child(?:ren)?)?$/.exec(value))) return `${m[1]} 位成人${m[2] ? `、${m[2]} 位子女` : ''}`;
  if ((m = /^(£[\d,.]+)\/mo$/.exec(value))) return `${m[1]}／月`;
  if ((m = /^([\d.]+%) plus a match up to ([\d.]+%)$/.exec(value))) return `${m[1]}，另加最高 ${m[2]} 的配比提撥`;
  if ((m = /^([\d.]+%) by (salary sacrifice|net pay|relief at source)$/.exec(value))) return `${m[1]}，採 ${m[2]}`;
  if ((m = /^(£[\d,.]+) home, (£[\d,.]+) mortgage$/.exec(value))) return `房產 ${m[1]}，房貸 ${m[2]}`;
  if ((m = /^Use (.+)$/.exec(value))) return `選用「${text(m[1]!)}」`;
  if ((m = /^Change (.+) on the profile form(?:: (\d+) inputs, starting with the first)?$/.exec(value))) return `在個人資料表單修改${text(m[1]!)}${m[2] ? `：共 ${m[2]} 個欄位，從第一個開始` : ''}`;
  if ((m = /^Change (your household|your salary|your spending|the age you want to stop)$/.exec(value))) return `修改${text(m[1]!)}`;
  if ((m = /^(.+): (.+)\. Change it under (.+)$/.exec(value))) return `${text(m[1]!)}：${text(m[2]!)}。前往「${text(m[3]!)}」修改`;
  if ((m = /^“Default” here means the situation the app opens with, (.+)\. Choose another under Start here and every marker is measured against that one instead\.$/.exec(value))) return `此處的「預設值」是 app 開啟時的情境「${text(m[1]!)}」。在「從這裡開始」選擇其他情境後，每個標記都會改以新情境為基準。`;
  if ((m = /^“Default” here means the starter situation you chose, (.+)\. Every edited marker and every reset on this form is measured against it\.$/.exec(value))) return `此處的「預設值」是你選擇的起始情境「${text(m[1]!)}」。表單上所有修改標記與還原操作都以它為基準。`;
  if ((m = /^The FIRE number is simple arithmetic: your yearly retirement spending ÷ ([\d.]+%), the withdrawal rate you configured\. It is a useful landmark for the size of pot you are aiming at, and it is silent about the tax you pay on withdrawals and about bad market years arriving early\.$/.exec(value))) return `FIRE 參考資本的計算很直接：退休年支出 ÷ 你設定的提領率 ${m[1]}。它能幫助掌握所需資產規模，但未反映提領稅負與退休初期遇上市場不佳的風險。`;
  if ((m = /^The success probability simulates your actual plan ([\d,]+) times, with taxes, inflation and market ups and downs\. It is the number your target is judged against\.$/.exec(value))) return `成功率以你的實際計畫模擬 ${m[1]} 次，納入稅負、通膨與市場漲跌。這才是判斷是否達到目標的數字。`;
  if ((m = /^([\d.]+%) arithmetic, so a landmark and not the safety result: the success probability over ([\d,]+) simulated futures is the number your target is judged against\.$/.exec(value))) return `依 ${m[1]} 提領率算出的金額只是規模參考；判斷安全性與是否達標，應看 ${m[2]} 個模擬未來的成功率。`;
  return undefined;
}
