/** Reverse Solver display copy, independent of engine state. */
export const solverZhTW: Readonly<Record<string, string>> = {
  "Inputs changed, so the previous answer was discarded": "輸入已變更，先前答案已清除",
  "A solved value only holds for the exact plan it was solved against. Any search in flight was cancelled; run the search again for the current profile.": "求得的數值只適用於當時的計畫。進行中的搜尋已取消；請重新求解目前資料。",
  "Search cancelled": "已取消搜尋",
  "No partial answer is published: a half-finished search is not a requirement.": "不會發布未完成的答案；尚未完成的搜尋不能用來判定需求。",
  "The search failed": "搜尋失敗",
  "The profile is invalid, so nothing can be sent to the engine": "資料有誤，無法送入 engine",
  "Your question": "你想問的問題",
  "Where the extra capital goes": "額外資本存入的帳戶",
  "Accessibility and tax differ by destination, so this choice changes the answer.": "不同帳戶的可動用時間與稅負不同，因此會影響答案。",
  "Exactly what moves:": "實際調整的項目：",
  "Also solve the section 33 sensitivity cases": "一併求解規格第 33 節的敏感度情境",
  "FIRE age +2, retirement spending −£150/month and equity returns −1pp, each re-solved in full. It roughly quadruples the work.": "FIRE 年齡增加 2 歲、退休支出減少 £150／月，以及股票報酬降低 1pp，皆各自重新完整求解。運算量約增加為四倍。",
  "This search does not apply to the current settings": "此搜尋不適用於目前設定",
  "Progress of the simulation in flight": "目前模擬的進度",
  "No answer yet": "尚未取得答案",
  "Nothing is shown until a search has finished": "搜尋完成後才會顯示結果",
  "Your answer": "你的答案",
  "Confirmed against the full model": "已使用完整模型確認",
  "No change needed": "無須調整",
  "Not reachable inside the bound": "搜尋邊界內無法達標",
  "Not applicable": "不適用",
  "How to read this answer": "如何判讀此答案",
  "The search": "搜尋內容",
  "What was asked and what was found": "本次問題與求解結果",
  "Sensitivity": "敏感度",
  "Each row is its own completed search": "每列皆為一次獨立完成的搜尋",
  "Spec section 33’s sensitivity block. Every value below was produced by re-running the whole search on a different plan — none of them is the headline scaled or interpolated.": "規格第 33 節的敏感度分析。下方每個值都來自不同計畫的一次完整重新求解，並非將主結果按比例縮放或內插而得。",
  "Case": "情境",
  "Result": "結果",
  "What changed": "調整內容",
  "The FIRE-age and spending cases run on the same seed and paths as the headline. The weaker-returns case changes the market assumption itself, so its paths are drawn from a different distribution and it is a separate model rather than a common-path comparison.": "FIRE 年齡與支出情境使用和主結果相同的種子與路徑。較低報酬情境改變了市場假設，路徑來自不同分布，因此屬於另一個模型，並非配對路徑比較。",
  "Sensitivity cases were switched off for this run, so none are shown. Turn them on above and solve again — they are computed, never canned.": "本次未啟用敏感度情境，因此沒有顯示。請在上方啟用後重新求解；結果都由實際運算產生。",
  "Evaluation trace": "評估紀錄",
  "Every candidate that was actually simulated": "所有實際模擬過的候選值",
  "In search order. Invalid candidates are plans the model does not support — a tapered pension allowance, for example — and are recorded as such rather than counted as plans that failed to fund themselves.": "依搜尋順序排列。無效候選值代表模型不支援的計畫，例如超過遞減後的退休金額度；會明確記錄，不會算成資金不足的計畫。",
  "Candidate": "候選值",
  "Verdict": "判定",
  "What produced this answer": "本次答案的計算依據",
  "Search metadata": "搜尋中繼資料",
  "General investment account (entered at cost)": "一般投資帳戶（以成本入帳）",
  "ISA balance": "ISA 餘額",
  "Pension (locked until the access age)": "退休金（可動用年齡前鎖定）",
  "The far end of the bounded search. If nothing up to this value clears the target, the answer is reported as not reachable inside the bound rather than extrapolated.": "搜尋範圍的遠端邊界。若測試到此值仍未達標，會回報邊界內無法達標，不會向外推估。",
  "The bar each candidate plan must clear. Defaults to the profile’s own target.": "每個候選計畫必須達到的門檻，預設使用個人資料中的目標。",
  "Evaluation budget": "評估次數上限",
  "Maximum number of complete simulations the search may run, excluding the confirmation run. A budget that runs out is reported, never hidden.": "搜尋最多可執行的完整模擬次數，不含確認運算。若用盡次數，會明確告知。",
  "Enter a target above 0% and at most 100%.": "請輸入大於 0% 且不超過 100% 的目標。",
  "Enter a whole evaluation budget between 3 and 200.": "請輸入 3 至 200 之間的整數評估次數。",
  "Enter a numeric search bound.": "請輸入數值搜尋邊界。",
  "This search raises the input, so the bound must be at or above the current value.": "此搜尋會提高輸入值，因此邊界必須大於或等於目前值。",
  "This search lowers the input, so the bound must be at or below the current value.": "此搜尋會降低輸入值，因此邊界必須小於或等於目前值。",
  "Limit the range to 61 candidate ages.": "每次最多測試 61 個候選年齡。",
  "Already met": "已達標",
  "Not reachable inside the search bound": "搜尋範圍內無法達標",
  "Current value": "目前值",
  "The entered plan, unchanged.": "原先輸入的計畫，未作調整。",
  "Probability of the entered plan": "原計畫成功率",
  "Required value": "所需值",
  "Smallest change tested that cleared the target.": "已測試且達標的最小調整。",
  "Confirmed on re-evaluation": "重新評估確認",
  "not confirmed": "尚未確認",
  "The returned plan was rebuilt and run again through the complete model, not read back from the search.": "已重新建立回傳的計畫，並再次執行完整模型，並非直接沿用搜尋時的結果。",
  "Largest tested value that failed": "已測試且未達標的最大值",
  "The requirement lies above this value and at or below the answer.": "需求高於此值，且不超過答案。",
  "Success did not move consistently with this input, so untested values below the answer may also qualify.": "成功率並未隨此輸入一致變化，因此答案以下未測試的值也可能達標。",
  "Search bound": "搜尋邊界",
  "Not evaluated.": "未評估。",
  "Search precision": "搜尋精度",
  "Exact for this seed and path set. Sampling uncertainty is separate and larger.": "對此種子與路徑組合而言，精確至搜尋步長。抽樣不確定性另計，且通常更大。",
  "Full simulations run": "已執行的完整模擬",
  "First-year investable surplus of the solved plan": "求得計畫第一年的可投資餘額",
  "Measured from the expected-value ledger of the returned plan, in today’s money.": "取自回傳計畫的期望值帳本，以今日幣值表示。",
  "Retirement spending of the solved plan": "求得計畫的退休支出",
  "Annual household total in today’s money, at the retirement level this run uses.": "本次退休支出水準下的家庭年支出，以今日幣值表示。",
  "The entered plan, for comparison.": "原先輸入的計畫，供比較使用。",
  "not applicable": "不適用",
  "This input is not assumed to help monotonically, so a coarse grid was scanned in order before the first qualifying interval was refined.": "此輸入不假設具有單調改善效果，因此先依序掃描粗略網格，再細化第一個達標區間。",
  "A larger change scored worse than a smaller one somewhere in the tested range. Read the evaluation trace rather than the headline alone.": "測試範圍中曾出現調整較大卻得分較低的情況。請一併閱讀評估紀錄。",
  "To hit my goal, what would my …": "要達到目標，我的……",
  "gross salary": "稅前薪資",
  "What you would have to earn, before tax, with your spending and everything else unchanged.": "在支出與其他設定不變時，稅前需要賺多少。",
  "annual savings": "年度儲蓄",
  "How much you would have to put away each working year, funded by spending less while you work.": "工作期間每年需要存多少，透過減少當時支出來支應。",
  "How long you would have to keep working, with pay, saving and spending unchanged.": "薪資、儲蓄與支出不變時，需要工作到何時。",
  "retirement spending": "退休支出",
  "What you would have to live on each month once you stop working, with working-life spending unchanged.": "工作期間支出不變時，退休後每月可使用多少生活費。",
  "extra starting capital": "額外起始資本",
  "How much you would have to hold today on top of your current assets — a windfall, not a plan.": "目前資產之外，今天還需要多少額外資本；這是意外獲得資金的假設。",
  "pension contribution": "退休金提撥比例",
  "What share of your pay would have to go into the pension, which shelters tax but locks the money up.": "薪資需要提撥多少比例至退休金；可以節稅，但資金會被鎖定。",
  "This search does not apply to the settings this run used, so no value was searched for.": "此搜尋不適用於本次設定，因此未搜尋任何值。",
  "Projection produced no years": "推估未產生任何年度",
  "Required gross salary": "所需稅前年薪",
  "Gross annual salary in today’s money, with spending, allocation, pension policy and every other input held fixed. Income tax, National Insurance, pension relief and contribution rates all follow the new salary, and the extra net pay reaches the accounts through the plan’s existing surplus allocation. Lifestyle creep, where configured, applies to the larger real salary too.": "以今日幣值表示的稅前年薪；支出、配置、退休金政策與其他輸入保持固定。所得稅、National Insurance、退休金減免與提撥率皆依新薪資計算，增加的實領薪資依計畫原有的餘額配置存入帳戶。若有設定生活支出隨收入增加，也會套用於較高的實質薪資。",
  "Required annual savings": "所需年度儲蓄",
  "Annual investable surplus during accumulation, in today’s money, funded by spending less while working. Income, tax and retirement spending are unchanged; the working-life budget is cut pound for pound, discretionary first, in the current-spending schedule and in any spending phase that ends at or before the FIRE age. No capital is created: the extra saving is money the household stops spending.": "累積期每年以今日幣值表示的可投資餘額，由工作期間減少支出支應。收入、稅負與退休支出不變；目前支出時程，以及在 FIRE 年齡前或當時結束的支出階段，會等額削減工作期間預算，優先減少彈性支出。額外儲蓄來自家庭不再花掉的錢，模型不會憑空增加資本。",
  "A household spending override replaces every schedule, so cutting the working-life budget would have no effect. Clear the override to search for required savings.": "家庭支出覆寫值會替換所有時程，因此削減工作期間預算不會生效。請先清除覆寫值，再求解所需儲蓄。",
  "Earliest qualifying FIRE age": "最早達標 FIRE 年齡",
  "The FIRE age itself. Retiring later means more contributing years, fewer funded retirement years and a shorter pre-pension bridge, but it also moves the plan relative to a property purchase, a mortgage term and the pension access age, so the probability is not assumed to rise with every extra year. Every candidate age in range is evaluated in order.": "調整 FIRE 年齡本身。延後退休會增加提撥年數、減少需支應的退休年數，也縮短退休金銜接期，但會同時改變計畫與購屋、房貸期限及退休金可動用年齡的關係，因此不假設成功率每多工作一年就會上升。範圍內每個候選年齡皆依序評估。",
  "Sustainable retirement spending": "可持續的退休支出",
  "Household retirement spending per month in today’s money, for the retirement level this run uses. Working-life spending, income and allocation are unchanged, so this is the spending reduction the plan needs from the FIRE age onwards. The reference FIRE number moves with it.": "本次支出水準下，以今日幣值表示的家庭每月退休支出。工作期間支出、收入與配置不變，因此此結果代表計畫從 FIRE 年齡起所需的支出削減。FIRE 參考資本也會隨之調整。",
  "A household spending override already fixes every year’s budget. Clear the override to search for sustainable retirement spending.": "家庭支出覆寫值已固定每年的預算。請清除覆寫值，再求解可持續的退休支出。",
  "Required additional starting capital": "所需額外起始資本",
  "An extra opening balance today, on top of the entered assets. This is an explicit hypothetical injection — the one search that adds money the plan does not already have — so the destination is chosen deliberately: it changes accessibility, tax and therefore the answer. A GIA injection is entered at cost, so it carries no latent gain.": "在已輸入資產之外，今天額外增加的期初餘額。此搜尋明確假設注入計畫尚未擁有的資金，因此須選擇存入帳戶；可動用時間與稅負會影響答案。存入 GIA 的資金以成本入帳，不帶有未實現利得。",
  "Required employee pension contribution": "所需員工退休金提撥比例",
  "The employee contribution rate, with the employer rate, match and method unchanged. Contributing more shelters income from tax but locks it until the pension access age, so a higher rate can strengthen the retirement years and starve the pre-pension bridge at the same time. Monotonicity is therefore not assumed: a coarse grid is scanned in order before the first qualifying interval is refined. Rates whose contributions exceed the available annual allowance are recorded as invalid candidates, not as plan failures.": "調整員工提撥率，雇主提撥率、配比與方式不變。增加提撥可減少所得稅，但資金會鎖定到退休金可動用年齡；因此可能改善退休後的資金，卻同時壓縮銜接期流動性。不假設單調改善：先依序掃描粗略網格，再細化第一個達標區間。超過可用年度額度的提撥率會列為無效候選值，不會算成計畫資金不足。",
  "Solver candidates must leave rentInvestment null; it belongs to the property comparison": "求解候選值的 rentInvestment 必須為 null；此選項只適用於房產比較",
  "targetProbability must be inside (0, 1]": "targetProbability 必須大於 0 且不超過 1",
  "maxEvaluations must be an integer >= 3": "maxEvaluations 必須為大於或等於 3 的整數",
  "A solver candidate changed the seed or path count; candidates must share the same draws": "候選值改變了種子或路徑數；候選值必須使用相同抽樣",
  "A solver candidate changed the market assumptions; candidates must share the same draws": "候選值改變了市場假設；候選值必須使用相同抽樣",
  "A solver candidate changed the projection horizon; candidates must share the same draws": "候選值改變了推估期間；候選值必須使用相同抽樣",
  "Search bound must be finite": "搜尋邊界必須為有限數值",
  "unknown error": "未知錯誤",
  "The confirmation run did not reproduce the search evaluation exactly; treat the result as unverified.": "確認運算未完全重現搜尋評估結果；請將答案視為尚未確認。",
  "Success probability did not rise consistently with this input across the tested values. The answer is the smallest value that was tested and cleared the target, not a proven minimum.": "測試值的成功率並未隨此輸入一致上升。答案是已測試且達標的最小值，尚未證明是實際最低需求。",
  "The entered plan already clears the target, so no change to this input is required.": "原先輸入的計畫已達標，因此無須調整此輸入。",
  "The search bound leaves no room to move this input in the helpful direction.": "搜尋邊界未留下朝有利方向調整此輸入的空間。",
  "not a supported plan": "模型不支援的計畫",
  "No supported change to this input could be searched, so no requirement can be reported.": "無法搜尋此輸入的任何受支援調整，因此無法回報所需值。",
  "Nothing inside the search bound reached the target. Widen the bound or move another input.": "搜尋範圍內沒有值達標。請擴大邊界或調整其他輸入。",
  "The evaluation budget ran out during the scan, so higher values were never tested.": "掃描時已用盡評估次數，因此未測試更高的值。",
  "No tested value reached the target. The evaluation trace below shows the whole scanned range, including values that scored worse than the entered plan.": "沒有已測試的值達標。下方評估紀錄涵蓋整個掃描範圍，包括得分比原計畫更低的值。",
  "The same search with the target FIRE age two years later.": "相同搜尋，目標 FIRE 年齡延後兩歲。",
  "The same search with a permanently smaller retirement budget.": "相同搜尋，永久降低退休預算。",
  "Expected equity return −1pp": "預期股票報酬 −1pp",
  "The same search against a weaker market assumption. These paths are drawn from a different distribution, so this row is a separate model, not a comparison on common paths.": "相同搜尋，改用較低的市場報酬假設。路徑來自不同分布，因此此列屬於另一個模型，並非配對路徑比較。"
};

export function translateSolverTemplate(value: string, text: (value: string) => string): string | undefined {
  let m: RegExpExecArray | null;
  if (value === 'To hit my goal, what would my … need to be?') return '要達到目標，我的哪個項目需要調整到多少？';
  if ((m = /^Search bound — (highest|lowest) value to test$/.exec(value))) return `搜尋邊界 — 測試的最${m[1] === 'highest' ? '高' : '低'}值`;
  if ((m = /^Searching for your (.+)\. One input moves; everything else stays exactly as entered\.$/.exec(value))) return `正在求解你的${text(m[1]!)}。每次只調整一項，其餘設定完全維持原輸入。`;
  if ((m = /^Work out my (.+)$/.exec(value))) return `求解我的${text(m[1]!)}`;
  if (value === 'Solving…') return '求解中…';
  if ((m = /^Up to ([\d,]+) complete simulations \(([\d,]+) lifetime projections\) across ([\d,]+) search(?:es)?\. Every candidate runs the configured path count; nothing is sampled down to make the search finish sooner\.$/.exec(value))) return `最多 ${m[1]} 次完整模擬（${m[2]} 個完整人生推估），分為 ${m[3]} 次搜尋。每個候選值皆使用設定的路徑數，不會自行減少抽樣來加快運算。`;
  if ((m = /^A requirement is only meaningful once a candidate has been confirmed against the complete model, so no estimate stands in for one\. Nothing runs until you ask it to: press Work out my (.+) above\.$/.exec(value))) return `候選值必須經過完整模型確認，才能用來判定需求，因此不會以估算代替。請按上方「求解我的${text(m[1]!)}」開始運算。`;
  if ((m = /^Completed in ([\d.]+) seconds over ([\d,]+) searched candidates at ([\d,]+) paths each\. Search precision and sampling uncertainty are different things: the value is exact for this seed and path set to the nearest search step, while the probability beside it carries a 95% sampling interval of about ± (.+)\.$/.exec(value))) return `已於 ${m[1]} 秒完成，共搜尋 ${m[2]} 個候選值，每個使用 ${m[3]} 條路徑。搜尋精度與抽樣不確定性不同：數值對此種子與路徑組合精確至搜尋步長，旁邊的成功率則帶有約 ± ${m[4]} 的 95% 抽樣區間。`;
  if ((m = /^Every candidate used seed (\d+) and path indices (\d+)–(\d+), so the difference between two candidates is the plan and nothing else\.$/.exec(value))) return `每個候選值皆使用種子 ${m[1]} 與路徑索引 ${m[2]}–${m[3]}，因此兩個候選值間的差異只來自計畫本身。`;
  if ((m = /^(.+) — (\d+) of about (\d+) complete simulations$/.exec(value))) return `${text(m[1]!)} — 已完成 ${m[2]} 次完整模擬，預計約 ${m[3]} 次`;
  if ((m = /^(.+): testing (.+)$/.exec(value))) return `${text(m[1]!)}：測試 ${text(m[2]!)}`;
  if ((m = /^(.+): checking whether (.+) is supported$/.exec(value))) return `${text(m[1]!)}：檢查是否支援 ${text(m[2]!)}`;
  if ((m = /^Confirming (.+) against the full model$/.exec(value))) return `使用完整模型確認 ${text(m[1]!)}`;
  if ((m = /^age (\d+)$/.exec(value))) return `${m[1]} 歲`;
  if ((m = /^(.+) ?\/ ?month$/.exec(value))) return `${m[1]}／月`;
  if ((m = /^Full-model success across ([\d,]+) paths\.$/.exec(value))) return `${m[1]} 條路徑的完整模型成功率。`;
  if ((m = /^Each one is a complete ([\d,]+)-path lifetime model\.$/.exec(value))) return `每次皆使用 ${m[1]} 條路徑執行完整終身模型。`;
  if ((m = /^Reaches ([\d.]+%)\.$/.exec(value))) return `達到 ${m[1]}。`;
  if ((m = /^already met at (.+)$/.exec(value))) return `${text(m[1]!)} 時已達標`;
  if ((m = /^not reachable below (.+)$/.exec(value))) return `${text(m[1]!)} 以下無法達標`;
  if ((m = /^Not a valid plan: (.+)$/.exec(value))) return `無效計畫：${text(m[1]!)}`;
  if ((m = /^FIRE age \+2 \((\d+)\)$/.exec(value))) return `FIRE 年齡 +2（${m[1]}）`;
  if ((m = /^Retirement spending −£(.+)\/month$/.exec(value))) return `退休支出 −£${m[1]}／月`;
  if ((m = /^The entered plan already reaches (.+) against a (.+) target, so no change to this input is required\. The search stopped at the current value rather than reporting a smaller one\.$/.exec(value))) return `原計畫成功率為 ${m[1]}，目標為 ${m[2]}，因此無須調整此輸入。搜尋停在目前值，未尋找更小的值。`;
  if ((m = /^Even at (.+) the plan reaches only (.+) against a (.+) target\. This input alone cannot close the gap inside the bound; widen the bound or move another input\.$/.exec(value))) return `即使調整到 ${text(m[1]!)}，成功率也只有 ${m[2]}，未達 ${m[3]} 目標。搜尋範圍內只調整此項無法補足差距；請擴大邊界或調整其他輸入。`;
  if ((m = /^Reaches (.+) against a (.+) target, re-checked against the complete model\. Today’s money; searched to the nearest (.+)\.$/.exec(value))) return `成功率為 ${m[1]}，目標為 ${m[2]}，已使用完整模型重新檢查。金額為今日幣值；搜尋精度為 ${text(m[3]!)}。`;
  if ((m = /^This question cannot be answered for your current settings\. (.+)$/.exec(value))) return `目前設定無法回答此問題。${text(m[1]!)}`;
  if ((m = /^Your (.+) does not have to change: at (.+) this plan already reaches (.+) against your (.+) target \((.+)\)\.$/.exec(value))) return `你的${text(m[1]!)}無須調整：目前 ${text(m[2]!)} 時，計畫成功率為 ${m[3]}，已達 ${m[4]} 目標（${text(m[5]!)}）。`;
  if ((m = /^the search stopped at your current (.+) rather than looking for a smaller one, so this is not the least you could get away with$/.exec(value))) return `搜尋停在目前${text(m[1]!)}，未尋找更低值，因此尚未證明這是最低需求`;
  if ((m = /^Changing your (.+) on its own would not be enough \((.+)\)\.$/.exec(value))) return `只調整你的${text(m[1]!)}仍不足以達標（${text(m[2]!)}）。`;
  if ((m = /^(.+) was the far end of the search and it (was never reached|reaches only .+), short of your (.+) target; nothing beyond that bound was tested, so widen it or change something else too$/.exec(value))) return `${text(m[1]!)} 為搜尋的遠端邊界，${m[2] === 'was never reached' ? '搜尋未到達此處' : '成功率僅 ' + m[2]!.slice('reaches only '.length)}，未達 ${m[3]} 目標；未測試此邊界之外的值，請擴大範圍或同時調整其他項目`;
  if ((m = /^You would need a (.+) of about (.+) \((.+)\)\.$/.exec(value))) return `你的${text(m[1]!)}約需 ${text(m[2]!)}（${text(m[3]!)}）。`;
  if ((m = /^Your (.+) would have to be about (.+) \((.+)\)\. Raise the evaluation budget to close the gap\.$/.exec(value))) return `你的${text(m[1]!)}約需 ${text(m[2]!)}（${text(m[3]!)}）。請提高評估次數上限，以縮小區間。`;
  if ((m = /^(.+), but the search ran out of evaluations before it could narrow that down: the least that would do is somewhere above (.+) and at or below (.+)$/.exec(value))) return `${text(m[1]!)}，但尚未縮小區間就已用盡評估次數：最低需求高於 ${text(m[2]!)}，且不超過 ${text(m[3]!)}`;
  if ((m = /^(.+); nothing below it was tested, so the true requirement may be lower$/.exec(value))) return `${text(m[1]!)}；未測試更低值，因此實際需求可能更低`;
  if ((m = /^(.+) and that (.+) does not$/.exec(value))) return `${text(m[1]!)}，且 ${text(m[2]!)} 未達標`;
  if ((m = /^we confirmed (.+) clears your (.+) target$/.exec(value))) return `已確認 ${text(m[1]!)} 達到 ${m[2]} 目標`;
  if ((m = /^(.+) cleared your (.+) target during the search, but the re-run did not reproduce it, so treat it as unverified$/.exec(value))) return `${text(m[1]!)} 在搜尋時達到 ${m[2]} 目標，但重跑未能重現，因此仍視為尚未確認`;
  if ((m = /^The entered plan could not be projected: (.+)$/.exec(value))) return `無法推估原計畫：${text(m[1]!)}`;
  if ((m = /^Values above (.+) are outside the supported model \((.+)\), so the search bound was reduced to the largest supported value\. This is a modelling boundary, not a plan failure\.$/.exec(value))) return `${text(m[1]!)} 以上的值不在模型支援範圍內（${text(m[2]!)}），因此搜尋邊界已縮小至最大受支援值。此為模型限制，並非計畫資金不足。`;
  if ((m = /^A coarse grid was scanned because success is not assumed to move consistently with this input, so a finer grid could find a qualifying value between (.+) and (.+)\.$/.exec(value))) return `此輸入不假設成功率會一致變化，因此先掃描粗略網格；更細的網格可能在 ${text(m[1]!)} 與 ${text(m[2]!)} 之間找到達標值。`;
  if ((m = /^The search stopped at its evaluation budget; the answer is the smallest qualifying value tested, and the requirement is somewhere above (.+)\.$/.exec(value))) return `搜尋已達評估次數上限；答案是已測試且達標的最小值，實際需求高於 ${text(m[1]!)}。`;
  return undefined;
}
