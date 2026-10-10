/** Scenario comparison display copy. User-authored names and notes bypass this catalog. */
export const scenarioZhTW: Readonly<Record<string,string>> = {
  "What these numbers mean": "這些數字代表什麼",
  "Inputs changed, so the previous comparison was discarded": "輸入已變更，先前比較已清除",
  "A comparison only holds for the exact plans it ran. Any run in flight was cancelled; run it again.": "比較結果僅適用於當時執行的計畫。執行中的比較已取消，請重新執行。",
  "No partial matrix is published. Nothing already computed is shown on its own.": "不會發布未完成的矩陣，也不會單獨顯示已計算的部分結果。",
  "Comparison could not be computed": "無法計算比較結果",
  "Invalid profile; no comparison can run": "個人資料無效，無法執行比較",
  "Comparison": "比較",
  "Compare plans on the same market paths": "使用相同市場路徑比較計畫",
  "All scenarios reuse the entered seed and the same absolute path indices (spec section 65), so a difference between two rows is a difference in the plan, not in the draw.": "所有情境都使用輸入的相同 seed 與絕對路徑索引（規格第 65 節），因此兩列的差異來自計畫本身，而非隨機抽樣。",
  "What to compare": "比較項目",
  "Capital strategy": "資金配置策略",
  "Required matrix (salary × spending × strategy)": "必要比較矩陣（年薪 × 支出 × 策略）",
  "Spending sensitivity (section 61)": "支出敏感度（第 61 節）",
  "Income uplift bands (section 62)": "收入提升級距（第 62 節）",
  "Saved named scenarios": "已儲存的具名情境",
  "Spending cases (section 61)": "支出情境（第 61 節）",
  "Each case replaces the household monthly total in working": "每個情境都會替換工作期間",
  "and": "與",
  "retirement years, so its effect on the investable surplus and on the capital the plan must reach are both visible in one run.": "退休期間的家庭每月總支出，因此一次執行就能看見可投資餘額與所需資產的變化。",
  "Run settings": "執行設定",
  "Search the earliest qualifying FIRE age": "搜尋最早符合條件的 FIRE 年齡",
  "Off by default: each candidate age is another complete simulation for every scenario.": "預設關閉：每個情境的每個候選年齡都需要額外執行一次完整模擬。",
  "Solve the required gross salary per scenario (section 61)": "求解各情境所需稅前年薪（第 61 節）",
  "Off by default: each scenario runs its own bounded salary search against the complete model, up to 25 more complete simulations.": "預設關閉：每個情境會使用完整模型，在指定範圍內搜尋所需年薪，最多額外執行 25 次完整模擬。",
  "Run a reduced-path preview instead": "改用較少路徑執行預覽",
  "A preview is labelled a preview everywhere it appears and is never presented as a full-count result.": "預覽結果會在所有顯示位置標示為預覽，不會被當作完整路徑數結果。",
  "This run is expensive": "此次執行需要較多運算",
  "Comparing…": "比較中…",
  "Run comparison": "執行比較",
  "Scenario progress": "情境進度",
  "Path progress in the current scenario": "目前情境的路徑進度",
  "Comparison basis": "比較依據",
  "Named scenarios": "具名情境",
  "Save, duplicate and edit alternatives": "儲存、複製與編輯替代計畫",
  "A scenario stores a validated profile and its plan options. Saved data is versioned and re-validated on every load: an older document is migrated explicitly and anything the profile schema rejects is refused, with reasons, rather than partially loaded.": "情境會儲存通過驗證的個人資料與計畫選項。資料有版本記錄，每次載入都會重新驗證：舊版本會明確轉換，未通過個人資料 schema 驗證的內容則會拒絕載入並說明原因，不會只載入部分資料。",
  "Saved scenarios could not be loaded": "無法載入已儲存的情境",
  "Scenario name": "情境名稱",
  "Save current profile as a scenario": "將目前資料儲存為情境",
  "Reload saved scenarios": "重新載入已儲存情境",
  "Forget saved scenarios": "清除已儲存情境",
  "Nothing is loaded; the stored document was refused.": "未載入任何情境；儲存的資料未通過驗證。",
  "No scenarios are saved in this browser yet.": "此瀏覽器尚未儲存任何情境。",
  "Choosing a situation replaces every value on the form and saves it here as a named scenario you can compare against later. It runs nothing, and it becomes the “default” that every edited marker and every reset is measured against until you choose another.": "選擇起始情境會替換表單中的所有數值，並在此儲存為具名情境，供日後比較。此操作不會執行計算；在你選擇其他情境前，它會成為所有編輯標記與重設操作的「預設」依據。",
  "Create from a preset": "從預設計畫建立",
  "Each preset is an explicit transform of the current profile, not a stored example result.": "每個預設計畫都會依明確規則調整目前資料，並非預先儲存的範例結果。",
  "Saved scenarios in this browser": "此瀏覽器儲存的情境",
  "Name": "名稱",
  "Salary": "年薪",
  "Spending": "支出",
  "Pension": "退休金",
  "Reproducibility": "重現資訊",
  "Actions": "操作",
  "Load": "載入",
  "Duplicate": "複製",
  "Replace with current": "以目前資料取代",
  "Delete": "刪除",
  "Export or import the versioned library": "匯出或匯入具版本資訊的情境庫",
  "Library JSON": "情境庫 JSON",
  "Export to the box": "匯出至文字框",
  "Import from the box": "從文字框匯入",
  "Imported text is validated and migrated exactly like stored data; an invalid document is refused with reasons.": "匯入文字會與儲存資料使用相同的驗證及版本轉換流程；無效資料會被拒絕並說明原因。",
  "You explicitly asked for a reduced-path preview. These figures carry preview sampling error and are not a full-count result; run without the preview before acting on them.": "你選擇了較少路徑的預覽。這些數值包含預覽的抽樣誤差，不是完整路徑數結果；請先關閉預覽重新執行，再據此做決定。",
  "Completed comparison": "比較已完成",
  "What these scenarios support saying": "這些情境結果支持哪些判讀？",
  "Spending sensitivity": "支出敏感度",
  "Both effects of a spending case": "支出情境的兩種影響",
  "A higher case lowers what the plan can invest this year and raises the retirement budget and the capital it implies. Both columns come from the same run.": "較高支出會降低今年可投資金額，同時提高退休預算與所需資產。兩欄都來自同一次執行。",
  "Case": "情境",
  "Investable surplus": "可投資餘額",
  "Total invested": "投入總額",
  "Retirement budget": "退休預算",
  "Reference FIRE number": "參考 FIRE 資產目標",
  "FIRE success": "FIRE 成功率",
  "Earliest qualifying age": "最早符合條件的年齡",
  "Required salary": "所需年薪",
  "Required matrix": "必要比較矩陣",
  "FIRE success by salary, spending and strategy": "各年薪、支出與策略的 FIRE 成功率",
  "Percentages are FIRE success; the second line is median net worth at that plan’s target FIRE age, in today’s money.": "百分比為 FIRE 成功率；第二行是該計畫目標 FIRE 年齡時的淨資產中位數，以今日幣值表示。",
  "Every scenario": "所有情境",
  "Take-home, contributions, wealth and outcome": "實領收入、提撥、資產與結果",
  "Scenario": "情境",
  "Take-home": "實領收入",
  "Marginal rate": "邊際稅率",
  "Pension contribution": "退休金提撥",
  "ISA contribution": "ISA 提撥",
  "Liquid @ FIRE": "FIRE 時流動資產",
  "Pension @ FIRE": "FIRE 時退休金",
  "Net worth @ FIRE": "FIRE 時淨資產",
  "Median terminal": "期末中位數",
  "P10 terminal": "期末 P10",
  "Unsupported:": "不支援：",
  "ISA Heavy": "ISA 優先",
  "Pension Tax-Band Optimised": "退休金稅率級距最佳化",
  "Balanced": "均衡配置",
  "Property": "房產",
  "Baseline": "原輸入計畫",
  "Pension Heavy": "退休金優先",
  "Income Growth": "收入提升",
  "Property Heavy": "房產優先",
  "No Property": "不持有房產",
  "Aggressive FIRE": "提早 FIRE",
  "Conservative FIRE": "延後 FIRE",
  "Contributes only what still earns the employer match already on offer, and directs the remaining surplus to the ISA allowance and then the GIA.": "僅提撥取得現有雇主配對提撥所需的退休金，其餘餘額先使用 ISA 額度，再投入 GIA。",
  "Raises the workplace contribution by the smallest amount that removes the top tax band the plan currently occupies, within the available annual allowance.": "在可用年度額度內，以最小的職場退休金提撥增額，退出目前最高所得稅級距。",
  "The entered contractual pension policy, with surplus filling the ISA allowance and then the GIA. This is the matrix reference point.": "維持輸入的合約退休金政策，餘額先使用 ISA 額度，再投入 GIA。此策略是矩陣的比較基準。",
  "Buys the configured property inside the same lifetime model, with its deposit, purchase tax, mortgage, running costs and rent replacement.": "在相同終身模型內購買設定的房產，納入頭期款、購屋稅、房貸、持有費用與取代租金的效果。",
  "The entered plan, unchanged.": "維持輸入的計畫，不做調整。",
  "Only the match-preserving pension contribution; the rest of the surplus goes to the ISA allowance then the GIA.": "退休金僅提撥保留雇主配對所需的金額；其餘餘額先使用 ISA 額度，再投入 GIA。",
  "Adds ten percentage points to the employee contribution, capped at what the annual allowance and relevant earnings support.": "將員工提撥率提高十個百分點，以年度額度及符合規定的收入所允許的金額為上限。",
  "Moves gross salary to the next band on the configured income-uplift axis (spec section 62).": "將稅前年薪提高至設定的收入提升軸上下一個級距（規格第 62 節）。",
  "Buys the configured property inside the same lifetime model.": "在相同終身模型內購買設定的房產。",
  "Removes the planned purchase and keeps the capital invested in financial assets.": "移除購屋計畫，將資金保留在金融資產中。",
  "Enter a salary of zero or more.": "請輸入大於或等於零的年薪。",
  "The first candidate age must be a whole age at or after the current age.": "第一個候選年齡必須為整數，且不得小於目前年齡。",
  "The last candidate age must be a whole age at or after the first and before the end age.": "最後候選年齡必須為整數，不得小於第一個候選年齡，且必須小於結束年齡。",
  "A preview needs a whole number of paths, at least one.": "預覽路徑數必須為至少一條的整數。",
  "Save at least one named scenario before comparing saved scenarios.": "請先儲存至少一個具名情境，才能比較已儲存情境。",
  "Scenarios evaluated": "已計算情境數",
  "Paths per scenario": "每個情境的路徑數",
  "All requested scenarios ran": "所有指定情境皆已執行",
  "The entered count, in full": "使用完整輸入路徑數",
  "Best tested success": "已測試的最高成功率",
  "Nothing evaluated": "沒有可計算的情境",
  "Shared seed": "共用 seed",
  "Every scenario reuses the same absolute path indices": "所有情境皆使用相同絕對路徑索引",
  "Entered schedule": "輸入的支出時程",
  "Every scenario in this batch was computed from scratch.": "此批次所有情境皆重新計算。",
  "No scenario in this batch could be evaluated. Each row states why.": "此批次沒有可計算的情境。各列會說明原因。"
};

/** Anchored formats keep numeric values and user-supplied labels intact. */
export function translateScenarioTemplate(value: string, text: (value:string)=>string): string | undefined {
  let m: RegExpMatchArray | null;
  if ((m=value.match(/^([\d,]+) scenarios? × up to ([\d,]+) complete simulations?(?: each)? = ([\d,]+) simulations, or ([\d,]+) lifetime projections\.(.*)$/)))
    return `${m[1]} 個情境 × 最多 ${m[2]} 次完整模擬 = ${m[3]} 次模擬，共 ${m[4]} 次終身推估。${text(m[5]!.trim())}`;
  if ((m=value.match(/^Up to ([\d,]+) of those per scenario are the required-salary solve, which searches gross pay against the complete model and confirms the answer; a solve that settles early spends fewer\. (.*)$/)))
    return `其中每個情境最多 ${m[1]} 次用於求解所需年薪，以完整模型搜尋稅前年薪並確認答案；提早找到答案時會減少執行次數。${text(m[2]!)}`;
  if ((m=value.match(/^The entered path count of ([\d,]+) is used in full; it is never reduced to finish sooner\.$/)))
    return `使用輸入的完整 ${m[1]} 條路徑，不會為了提早完成而減少路徑數。`;
  if ((m=value.match(/^PREVIEW: you asked for ([\d,]+) paths instead of the entered ([\d,]+)\. Its numbers are labelled a preview and must not be read as a full-count result\.$/)))
    return `預覽：你選擇使用 ${m[1]} 條路徑，而非輸入的 ${m[2]} 條。結果會標示為預覽，不可當作完整路徑數結果。`;
  if ((m=value.match(/^This is ([\d,]+) complete simulations at ([\d,]+) paths and can take several minutes\. Lower the path count explicitly, or choose a labelled preview, if that is too long\.$/)))
    return `此次共有 ${m[1]} 次完整模擬，每次 ${m[2]} 條路徑，可能需要數分鐘。若時間太長，請自行降低路徑數，或選擇明確標示的預覽。`;
  if ((m=value.match(/^(.*) — ([\d,]+) of ([\d,]+) scenarios complete$/)))
    return `${m[1]} — 已完成 ${m[2]}／${m[3]} 個情境`;
  if ((m=value.match(/^Migrated (\d+) scenario\(s\) from schema (\d+)$/))) return `已從 schema ${m[2]} 轉換 ${m[1]} 個情境`;
  if ((m=value.match(/^Saved (\d+) scenario\(s\) at (.*)\.$/))) return `已儲存 ${m[1]} 個情境，時間：${m[2]}。`;
  if ((m=value.match(/^Loaded (\d+) scenario\(s\) saved at (.*)\.$/))) return `已載入 ${m[1]} 個情境，儲存時間：${m[2]}。`;
  if ((m=value.match(/^PREVIEW — (\d+) of (\d+) paths$/))) return `預覽 — ${m[1]}／${m[2]} 條路徑`;
  if ((m=value.match(/^PREVIEW of the entered ([\d,]+)$/))) return `輸入 ${m[1]} 條路徑的預覽`;
  if ((m=value.match(/^([\d,]+) unsupported, each with its reason$/))) return `${m[1]} 個不支援的情境，皆附原因`;
  if ((m=value.match(/^([\d,]+) paths, seed (.*)$/))) return `${m[1]} 條路徑，seed ${m[2]}`;
  if ((m=value.match(/^(.*%) employee$/))) return `員工提撥 ${m[1]}`;
  if ((m=value.match(/^At (\d+)$/))) return `${m[1]} 歲時`;
  if ((m=value.match(/^None in (\d+)–(\d+)$/))) return `${m[1]}–${m[2]} 歲間皆未達標`;
  if ((m=value.match(/^(£[\d,]+) \(already met\)$/))) return `${m[1]}（已達標）`;
  if ((m=value.match(/^None up to (£[\d,]+)$/))) return `測試至 ${m[1]} 仍未達標`;
  if ((m=value.match(/^(£[\d,]+) \(confirmation run did not clear the target\)$/))) return `${m[1]}（確認執行未達目標）`;
  if ((m=value.match(/^Entered salary (.*?) reaches (.*?) against a (.*?) target\.$/))) return `輸入年薪 ${m[1]} 的成功率為 ${text(m[2]!)}，目標為 ${m[3]}。`;
  if ((m=value.match(/^Bracketed between (.*?) \(did not clear\) and (.*?) \(cleared\), to the nearest (.*?)\.$/))) return `介於 ${m[1]}（未達標）與 ${m[2]}（達標），精度為 ${m[3]}。`;
  if ((m=value.match(/^An independent re-run of (.*?) reached (.*?)\.$/))) return `以 ${m[1]} 獨立重跑，成功率為 ${m[2]}。`;
  if ((m=value.match(/^([\d,]+) complete simulations? searched this cell\.$/))) return `此格共執行 ${m[1]} 次完整模擬搜尋。`;
  if ((m=value.match(/^([\d,]+) of ([\d,]+) scenarios reused an identical cached result\. A cached cell is keyed on the whole profile, every run option and the engine, tax and generator versions, so it can only be reused for exactly the same inputs\.$/)))
    return `${m[1]}／${m[2]} 個情境重用相同的快取結果。快取依據完整個人資料、所有執行選項及 engine、稅制與路徑產生器版本識別，因此僅能在輸入完全相同時重用。`;
  if ((m=value.match(/^Brings the target FIRE age forward (\d+) years\.$/))) return `將目標 FIRE 年齡提前 ${m[1]} 年。`;
  if ((m=value.match(/^Delays the target FIRE age by (\d+) years\.$/))) return `將目標 FIRE 年齡延後 ${m[1]} 年。`;
  if ((m=value.match(/^(.*?) lead within paired sampling uncertainty, so this batch does not separate them\.(.*)$/)))
    return `${m[1]} 的領先仍在配對抽樣不確定性內，此批次無法區分其優劣。${text(m[2]!.trim())}`;
  if ((m=value.match(/^(.*?) leads at (.*?)\. It (clears|still falls short of) the (.*?) target\.(.*)$/)))
    return `${m[1]} 以 ${text(m[2]!)} 領先，${m[3]==='clears'?'達到':'仍未達到'} ${m[4]} 的目標。${text(m[5]!.trim())}`;
  if ((m=value.match(/^([\d,]+) scenarios? could not be modelled and (?:states its reason|state their reasons) instead of a figure\.(.*)$/)))
    return `${m[1]} 個情境無法建模，會說明原因而不顯示數值。${text(m[2]!.trim())}`;
  if ((m=value.match(/^These are PREVIEW figures at ([\d,]+) of ([\d,]+) paths, not a full-count result\.$/)))
    return `這些是 ${m[1]}／${m[2]} 條路徑的預覽數值，不是完整路徑數結果。`;
  if ((m=value.match(/^Averaged across this matrix, (income|spending|capital strategy) moves FIRE success most \((.*?) between its best and worst band\), then (income|spending|capital strategy) \((.*?)\) and (income|spending|capital strategy) \((.*?)\)\. These are averages over the other axes on one set of common paths, not an attribution of a single plan's gap — that is package 9\.$/))) {
    const axis:Record<string,string>={income:'收入',spending:'支出','capital strategy':'資金配置策略'};
    return `此矩陣平均而言，${axis[m[1]!]}對 FIRE 成功率的影響最大（最佳與最差級距相差 ${m[2]}），其次為${axis[m[3]!]}（${m[4]}）與${axis[m[5]!]}（${m[6]}）。這是在同一組共用路徑上，對其他軸取平均的結果；單一計畫差距的來源分析由工作套件 9 負責。`;
  }
  if ((m=value.match(/^(£[\d,]+k) · (£[\d,]+\/mo) · (ISA Heavy|Pension Tax-Band Optimised|Balanced|Property)$/))) return `${m[1]} · ${text(m[2]!)} · ${text(m[3]!)}`;
  if ((m=value.match(/^Contractual employee contribution of (.*?)% retained\.$/))) return `維持合約員工提撥率 ${m[1]}%。`;
  if ((m=value.match(/^Employee pension contribution set to (.*?)% — the match-preserving minimum for the entered policy\. Surplus fills the ISA allowance first\.$/))) return `員工退休金提撥率設為 ${m[1]}%，即輸入政策下保留雇主配對的最低比率。餘額優先使用 ISA 額度。`;
  if ((m=value.match(/^Employee pension contribution set to (.*?)%\.$/))) return `員工退休金提撥率設為 ${m[1]}%。`;
  if ((m=value.match(/^Employee contribution raised to (.*?)%\.$/))) return `員工提撥率提高至 ${m[1]}%。`;
  if ((m=value.match(/^Employee contribution raised to (.*?)%, limited by the annual allowance or relevant earnings in a later projected year\.$/))) return `員工提撥率提高至 ${m[1]}%，受後續推估年度的年度額度或符合規定的收入限制。`;
  if ((m=value.match(/^Employee contribution raised to (.*?)% of pensionable pay, the smallest contribution that leaves the (.*?) band\.(.*)$/))) return `員工提撥提高至退休金計算薪資的 ${m[1]}%，為退出${text(m[2]!)}級距所需的最小提撥。${text(m[3]!.trim())}`;
  if ((m=value.match(/^Held at (.*?)% because a later projected year would exceed the available annual allowance, so the band is not fully vacated\.$/))) return `因後續推估年度會超過可用年度額度，提撥率限制為 ${m[1]}%，因此未完全退出該級距。`;
  if ((m=value.match(/^Buys at age (\d+) for (£[\d,]+) with a (£[\d,]+) deposit\.$/))) return `${m[1]} 歲時以 ${m[2]} 購屋，頭期款為 ${m[3]}。`;
  if ((m=value.match(/^Buys at age (\d+) for (£[\d,]+)\.$/))) return `${m[1]} 歲時以 ${m[2]} 購屋。`;
  if ((m=value.match(/^Gross salary raised to (£[\d,]+), the next configured uplift band\.$/))) return `稅前年薪提高至 ${m[1]}，即設定的下一個收入提升級距。`;
  if ((m=value.match(/^Target FIRE age moved to (\d+)\.$/))) return `目標 FIRE 年齡改為 ${m[1]} 歲。`;
  if ((m=value.match(/^No contribution the annual allowance supports leaves the (.*?) band\.$/))) return `年度額度允許的提撥皆無法退出${text(m[1]!)}級距。`;
  if ((m=value.match(/^Rounding the solved contribution to a storable rate did not clear the (.*?) band\.$/))) return `將求解提撥四捨五入為可儲存的比率後，未能退出${text(m[1]!)}級距。`;
  if ((m=value.match(/^(ISA Heavy|Pension Heavy|Baseline|Income Growth|Property Heavy|No Property|Aggressive FIRE|Conservative FIRE): (.*)$/))) return `${text(m[1]!)}：${text(m[2]!)}`;
  if ((m=value.match(/^A library holds at most (\d+) scenarios$/))) return `情境庫最多可儲存 ${m[1]} 個情境`;
  if ((m=value.match(/^Unknown scenario (.*)$/))) return `未知情境 ${m[1]}`;
  if ((m=value.match(/^Duplicate scenario (id|name) (.*)$/))) return `情境${m[1]==='id'?' ID':'名稱'}重複：${m[2]}`;
  if ((m=value.match(/^Not a scenario library: expected kind (.*)$/))) return `這不是情境庫：kind 應為 ${m[1]}`;
  if ((m=value.match(/^Unsupported scenario library version (.*); this build reads (\d+) and (\d+)$/))) return `不支援情境庫版本 ${m[1]}；此版本可讀取 ${m[2]} 與 ${m[3]}`;
  if ((m=value.match(/^Saved library did not round-trip: (.*)$/))) return `儲存後的情境庫未通過重新載入驗證：${text(m[1]!)}`;
  if ((m=value.match(/^([\w.]+): (.*)$/))) { const translated=text(m[2]!);if(translated!==m[2]) return `${m[1]}：${translated}`; }
  if (value==='A scenario library must be a JSON object') return '情境庫必須為 JSON object';
  if ((m=value.match(/^Invalid input: expected (\w+), received (\w+)$/))) return `輸入無效：預期為 ${m[1]}，收到 ${m[2]}`;
  if ((m=value.match(/^Too (small|big): expected (string|array) to have (>=|<=)(\d+) (characters|items)$/))) return `${m[2]==='string'?'文字長度':'項目數'}必須${m[3]==='>='?'至少':'不超過'} ${m[4]}${m[5]==='characters'?' 個字元':' 個項目'}`;
  if ((m=value.match(/^Unexpected (.*)$/))) return `JSON 格式無效：Unexpected ${m[1]}`;
  if ((m=value.match(/^([\d,]+) of ([\d,]+) scenarios complete$/))) return `已完成 ${m[1]}／${m[2]} 個情境`;
  if ((m=value.match(/^Unrecognized keys?: (.*)$/))) return `無法辨識的欄位：${m[1]}`;
  if ((m=value.match(/^Invalid option: expected one of (.*)$/))) return `選項無效，必須為下列之一：${m[1]}`;
  if ((m=value.match(/^Invalid input: expected (".*")$/))) return `輸入無效：預期為 ${m[1]}`;
  if ((m=value.match(/^Expected (.*?) in JSON at position (\d+) \(line (\d+) column (\d+)\)$/))) return `JSON 語法錯誤：預期為 ${m[1]}，位置 ${m[2]}（第 ${m[3]} 行、第 ${m[4]} 欄）`;
  if (value==='Unexpected end of JSON input') return 'JSON 內容不完整，無法解析';
  return undefined;
}

export const scenarioBasisZhTW: Readonly<Record<string,string>> = {
  "Every scenario runs the complete lifetime ledger — the same tax rules, allowances, contribution methods, property cash flows, spending policy, liquidity constraints and Monte Carlo engine as the FIRE screen. Nothing here scales or interpolates a result.": "每個情境皆執行完整終身帳本，使用與 FIRE 頁面相同的稅制、額度、提撥方式、房產現金流、支出政策、流動性限制與 Monte Carlo engine。此處不會縮放或內插結果。",
  "Common random numbers (spec section 65): all scenarios reuse the entered seed and the same absolute path indices, so a difference between two cells is a difference in the plan, not in the draw. A saved scenario that changes the seed, horizon or market assumptions is reported as incomparable rather than compared.": "共用隨機數（規格第 65 節）：所有情境共用輸入的 seed 與相同絕對路徑索引，因此兩格的差異來自計畫，而非抽樣。若已儲存情境改變 seed、推估期間或市場假設，會標示為無法比較，不會硬做比較。",
  "Money is in today’s terms. Take-home, tax, contributions and surplus are the first projected year; liquid, pension and net wealth are medians at that plan’s own target FIRE age; terminal wealth is at the end age. ± is a 95% Monte Carlo sampling interval, and a lead inside it is reported as a tie rather than as a finding.": "金額以今日幣值表示。實領收入、稅額、提撥與餘額為第一個推估年度；流動資產、退休金與淨資產為各計畫目標 FIRE 年齡時的中位數；期末資產則對應結束年齡。± 表示 95% Monte Carlo 抽樣區間，區間內的領先會視為無法區分，不會當作確定發現。",
  "Spending cases change both sides of the problem at once: a higher case lowers this year’s investable surplus AND raises the retirement budget and the capital the plan must reach. Both columns come from the same run.": "支出情境同時改變問題的兩面：較高支出會降低今年可投資餘額，也會提高退休預算與計畫所需資產。兩欄皆來自同一次執行。",
  "Strategy definitions are explicit transforms of the entered plan. ISA Heavy contributes only what still earns the employer match on offer. Pension Tax-Band Optimised raises the workplace contribution by the smallest amount that vacates the top tax band the plan occupies, then caps it at what the annual allowance supports in later years. Balanced keeps the contractual policy. Property buys the configured purchase inside the same model.": "策略皆依明確規則調整輸入計畫。ISA 優先僅提撥取得現有雇主配對所需的退休金。退休金稅率級距最佳化以最小的職場提撥增額退出目前最高所得稅級距，再以後續年度額度允許的金額為上限。均衡配置維持合約政策。房產策略在相同模型內執行設定的購屋計畫。",
  "Unsupported is not failure: a strategy this profile cannot express, or a contribution beyond the available annual allowance, states its reason and shows no figures. A cancelled run publishes nothing at all — no partial matrix.": "不支援不等於資金不足：若個人資料無法表達某策略，或提撥超出可用年度額度，會說明原因且不顯示數值。取消執行不會發布任何結果，也不會顯示未完成的矩陣。",
  "A preview is only produced when you ask for one, is labelled a preview everywhere it appears, and is cached separately so it can never stand in for a full-count result.": "只有在你選擇預覽時才會產生預覽，所有顯示位置都會清楚標示，且快取分開儲存，避免被當作完整路徑數結果。"
};

export const scenarioErrorsZhTW: Readonly<Record<string,string>> = {
  "Run options were defaulted because schema": "執行選項已套用預設值，因為 schema",
  "did not store them. Save again to keep the migrated form.": "未儲存這些選項。請再次儲存以保留轉換後的資料。",
  "This plan already owns a property, so a no-property scenario would delete an asset it actually holds.": "此計畫已持有房產，無房產情境會刪除實際持有的資產，因此不支援。",
  "This plan already owns the single property V0.3 models; there is no additional purchase to compare.": "此計畫已持有 V0.3 模型支援的唯一房產，沒有額外購屋計畫可比較。",
  "The property strategy needs a planned purchase; an existing holding has no unspent deposit.": "房產策略需要購屋計畫；已持有房產沒有尚未支付的頭期款。",
  "No pensionable pay, so no band can be optimised.": "沒有退休金計算薪資，因此無法最佳化稅率級距。",
  "The entered contribution already exceeds an allowance, so no optimisation is offered.": "輸入提撥已超過額度，因此不提供最佳化。",
  "Taxable income is already inside the lowest non-savings band.": "應稅收入已在最低非儲蓄所得稅級距內。",
  "The property strategy needs a configured purchase; enter one on the Property & Leverage screen or in the scenario controls.": "房產策略需要已設定的購屋計畫；請在房產與槓桿頁面或情境控制項中輸入。",
  "No additional workplace contribution is supported by the available annual allowance or relevant earnings.": "可用年度額度或符合規定的收入不允許額外職場退休金提撥。",
  "Salary is already at or above the top of the configured income-uplift axis.": "年薪已達到或超過設定收入提升軸的最高值。",
  "No property purchase is configured to compare.": "尚未設定可供比較的購屋計畫。",
  "The entered plan already has no property.": "輸入計畫已經沒有房產。",
  "Planned purchase removed.": "已移除購屋計畫。",
  "A FIRE age three years earlier would fall before the current age.": "將 FIRE 年齡提前三年後會小於目前年齡。",
  "A FIRE age three years later would fall at or after the end age.": "將 FIRE 年齡延後三年後會達到或超過結束年齡。",
  "Scenario cells must share the seed, path indices, horizon and market assumptions.": "各情境必須共用 seed、路徑索引、推估期間與市場假設。",
  "Could not find an unused scenario name": "找不到尚未使用的情境名稱",
  "Migrated from schema 1; run options defaulted.": "已從 schema 1 轉換；執行選項使用預設值。"
};
