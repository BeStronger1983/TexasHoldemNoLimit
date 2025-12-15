
# 無限注德州撲克（No-Limit Texas Hold'em）規格書（Spec）

> 專案類型：純 Client（無 Server）
> 
> 引擎：Cocos Creator 3.8.7 + TypeScript

## 1. 文件目的

本文件定義「無限注德州撲克」單機版（純 Client）遊戲的功能需求、遊戲規則、UI/UX 流程、系統架構、資料模型、AI 行為與驗收標準，作為開發與測試的共同依據。

## 2. 產品範圍

### 2.1 目標（Goals）

- 在單機環境提供完整的無限注德州撲克體驗（9 人桌內隨機人數）。
- 每局開始時隨機 2–9 人入局，其中 **恰好 1 位為人類玩家**，其他皆為 AI。
- 具備可重複、可驗證的牌局流程（含邊池、All-in、棄牌等）。
- 在沒有 Server 的前提下，確保遊戲邏輯一致性、可測試性（可固定亂數種子）與基本可玩性。

### 2.2 非目標（Non-goals）

- 不提供線上對戰、配桌、排行、雲端存檔。
- 不提供真實金錢交易或任何需要法規/支付的功能。
- 不要求高階 AI（GTO/深度學習）；以「可玩、可調難度、可擴充」為主。

## 3. 平台與限制

### 3.1 技術限制

- 無 Server：所有邏輯（發牌、下注、AI 決策、結算、存檔）都在本機執行。
- 必須可離線運行。
- 需避免依賴第三方雲端服務。

### 3.2 專案規範

- 使用 Cocos Creator 3.8.7。
- 使用 TypeScript。
- 作者端腳本放於 `assets/`（避免修改 `library/`、`temp/` 等生成內容）。

## 4. 名詞定義

- Session：一場遊戲（由多手牌 Hand 組成），直到結束條件達成（人類破產或人類成為最後留在桌上的玩家）。
- Hand：一局牌（從發手牌到攤牌/結算）。
- Street：下注輪次（Preflop / Flop / Turn / River）。
- Button（BTN）：莊家位。
- Small Blind（SB）/ Big Blind（BB）：小盲/大盲。
- All-in：玩家押上其剩餘全部籌碼。
- Side Pot：邊池。

## 5. 核心遊戲規則

### 5.1 人數與座位

- 每個 Session 開始時，隨機產生桌上玩家數 $N$，其中 $2 \le N \le 9$。
- 恰好 1 位為人類玩家，且人類玩家座位為隨機。
- 其他 $N-1$ 位為 AI。
- 未入局的座位顯示為空位。

### 5.2 牌組與洗牌

- 使用標準 52 張牌，不含鬼牌。
- 每局開始前建立新牌組並洗牌。
- 發牌順序遵循實際桌上順時針流程。

### 5.3 盲注與起始籌碼（可配置）

以下參數必須集中在「可配置資料」中（例如 Scriptable config / JSON / 常數集中管理）：

- `startingStack`：每位玩家起始籌碼（預設：1000）。
- `smallBlind`、`bigBlind`（預設：5 / 10）。
- `ante`（預設：0；可開關）。
- `blindIncreasePolicy`：固定盲注（第一版採固定盲注）。

### 5.4 發牌與公共牌

- 每位在局玩家獲得 2 張手牌（Hole Cards）。
- 公共牌依序：Flop 3 張、Turn 1 張、River 1 張。
- 燒牌（Burn card）規則：
	- 為了接近真實規則，可在 Flop/Turn/River 前各燒 1 張（可配置；預設開啟）。

### 5.5 下注規則（No-Limit）

- 下注輪次：Preflop → Flop → Turn → River。
- 行動順序：
	- Preflop：從 BB 左手邊（UTG）開始。
	- Flop/Turn/River：從 BTN 左手邊第一位仍在局玩家開始（即 SB 位置起算，但若 SB 不在局則往後找）。
- 合法動作（依情境）：
	- `Fold`（棄牌）
	- `Check`（過牌；當前需跟注額為 0）
	- `Call`（跟注）
	- `Bet`（下注；當前無人下注時）
	- `Raise`（加注；當前有人下注/加注時）
	- `All-in`（任意時刻押上剩餘全部籌碼；可視為 Bet 或 Raise 或 Call 的特殊情形）
- 最小加注（No-Limit 常規）：
	- 若存在上一個有效下注/加注額度，最小加注增量 = 上一次加注增量。
	- 若玩家 All-in 不足最小加注增量，視為「不構成重新開池」的加注（是否重新開池依規則，見 5.7）。

### 5.6 一輪下注結束條件

當同一輪中滿足以下任一條件，結束該 Street：

- 只剩 1 位玩家未棄牌（直接贏得底池，無需攤牌）。
- 所有仍在局且未 All-in 的玩家都「行動完成」且「已對齊當前最高下注額」（call/raise 後被跟齊），且最後加注者之後的玩家都已回應。
- 若所有仍在局玩家皆 All-in（或只剩 All-in 玩家），則跳過後續下注輪，直接補齊公共牌到 River 後結算。

### 5.7 邊池（Side Pot）與重新開池（Reopen）

- 必須支援多位玩家 All-in 形成多個邊池。
- 邊池計算：
	- 以各玩家在該手牌的總投入（contribution）排序，逐層切分底池。
	- 每個池的競逐者為「對該池層級有投入且未棄牌」的玩家。
- 重新開池（簡化且可配置）：
	- 預設採用常見現場規則：若某玩家 All-in 的加注不足最小加注額，不會重新開池給前面已行動玩家再加注的權利。
	- 由於實作複雜度高，允許在第一版採「一致且可測」的明確規則：
		- `reopenOnShortAllinRaise`：預設 `false`。
		- 若設為 `false`：不足最小加注增量的 All-in 只會改變需跟注額，但不會讓已行動玩家重新取得 raise 權。

### 5.8 攤牌與比牌

- 若 River 後仍有 2 位以上玩家未棄牌，進入攤牌。
- 手牌比較：使用 7 張牌（2 手牌 + 5 公共牌）取最佳 5 張。
- 勝負判定：標準德州撲克牌型與踢腳（kicker）規則。
- 平分底池：
	- 若多位玩家最佳手牌完全相同，該池均分。
	- 需要處理不可整除的籌碼（odd chip）規則（見 9.6）。

## 6. 遊戲流程（高階）

### 6.1 單局流程

1. 生成本次 Session 玩家數 $N \in [2,9]$，建立玩家列表（1 真人 + $N-1$ AI）。
2. 隨機指派座位（Seat 0..8），人類玩家座位隨機。
3. 指派 Button：第一手隨機、之後每手順時針輪轉。
3. 扣除 Ante（若啟用）。
4. 扣除盲注（SB/BB）。
5. 洗牌、發手牌。
6. 進行 Preflop 下注。
7. 若未提前結束：發 Flop → 下注。
8. 若未提前結束：發 Turn → 下注。
9. 若未提前結束：發 River → 下注。
10. 攤牌 / 結算（含邊池）。
11. 更新籌碼：AI 玩家若 stack=0 則離桌；人類玩家若 stack=0 則 Session 結束（失敗）。
12. 若人類玩家成為最後留在桌上的玩家（其餘 AI 全離桌），Session 結束（勝利）。
13. 若 Session 尚未結束：Button 輪轉，進入下一手 Hand。

### 6.2 牌局狀態機（State Machine）

必須以明確狀態機實作，避免 UI/AI/動畫互相打架。

建議狀態：

- `Boot`
- `MainMenu`
- `TableSetup`（決定人數、座位、起始籌碼、Button）
- `PostingBlinds`（含 ante）
- `DealHoleCards`
- `BettingPreflop`
- `DealFlop`
- `BettingFlop`
- `DealTurn`
- `BettingTurn`
- `DealRiver`
- `BettingRiver`
- `Showdown`
- `Payout`（分池發籌碼）
- `HandSummary`（結果顯示）
- `NextHandOrExit`

每個狀態需定義：

- 進入條件（guards）
- 退出條件
- 觸發事件（玩家動作、AI 動作完成、動畫完成、定時器）
- 可重入/不可重入規則

## 7. 玩家與 AI 行為需求

### 7.1 人類玩家操作

- 在輪到人類玩家時，必須顯示可用動作（Fold/Check/Call/Bet/Raise/All-in）與對應金額。
- `Raise/Bet` 必須提供金額輸入：
	- 建議用滑桿 + 快捷按鈕（例如 1/2 Pot、Pot、All-in）（UI 是否包含快捷按鈕見待決；第一版可僅滑桿）。
- 必須避免非法操作：
	- 不能在需跟注額 > 0 時按 Check。
	- Raise 低於最小加注時應禁用或自動修正至最小值（All-in 例外）。

### 7.2 AI 玩家（Bots）

#### 7.2.1 目標

- AI 行為需符合下注規則、不卡死流程。
- AI 決策要「可預測到可測試」：可用亂數種子重現同一局。
- AI 至少提供 2–3 檔難度（可配置）。

#### 7.2.2 AI 決策輸入

AI 在每次行動時可讀取：

- 自身手牌（兩張）
- 公共牌
- 位置（BTN/SB/BB/UTG…）
- 當前 Street、當前需跟注額、可用最小加注
- 底池大小、有效籌碼（effective stack）
- 對手人數、仍在局人數、已 all-in 人數
- 自己與桌面歷史（本手牌內的下注序列）

#### 7.2.3 AI 決策模型（第一版建議：規則 + 機率）

- Preflop：使用簡化起手牌表（Hand Strength buckets），依位置調整開池/跟注/3bet 機率。
- Postflop：以「手牌強度估計」+「底池賠率」+「隨機擾動」做決策。
	- 手牌強度估計可用：
		- 牌型等級（made hand）
		- 抽牌（draw）分類（同花聽牌、順子聽牌）
		- Board texture（乾/濕）簡化判定
- 行為輸出：Fold/Call/Check/Bet/Raise/All-in 與金額。

#### 7.2.4 AI 金額策略（Bet sizing）

- Bet/Raise 金額以底池比例為主（例如 33% / 50% / 75% / Pot），並依難度調整混合比例。
- 全下條件：
	- 很強牌、很短碼、或在某些聽牌/半詐唬情境以小機率觸發。

#### 7.2.5 思考時間

- AI 每次行動需有延遲（例如 300–1200ms 隨機）以符合體感。
- 需可在設定中關閉/縮短（加速測試）。

## 8. UI / UX 規格（最低可玩集）

> 無 Server 專案的 UI 要避免依賴登入、連線狀態等。

### 8.1 畫面列表

第一版建議最少 2 個畫面：

- 主選單（Main Menu）
	- `開始遊戲`
	- `設定`（音量、語言可先固定 zh-tw、AI 思考時間、盲注/起始籌碼等）
	- `離開`（桌機）
- 遊戲桌（Table Scene）
	- 9 座位視圖（依本局 2–9 人填入）
	- 公共牌區
	- 底池/邊池顯示
	- 人類玩家操作區
	- 事件/提示文字區（例如「輪到你行動」、「AI 加注到 50」）

### 8.2 座位顯示

每個座位需包含：

- 玩家名稱（AI 可為 Bot_1…）
- 籌碼量
- 狀態（Fold、All-in、Turn indicator）
- 下注額（當前輪次投入）
- 手牌（人類玩家可見；AI 手牌預設遮住，攤牌時揭示）

### 8.3 操作區（人類玩家）

- 按鈕：`Fold`、`Check/Call`（同一鍵依情境切換）
- `Bet/Raise`：金額選擇（滑桿）+ 確認按鈕
- `All-in` 快捷
- 顯示：
	- 需跟注額（To Call）
	- 最小加注（Min Raise）
	- 底池（Pot）

### 8.4 動畫與可讀性

- 必須以「遊戲邏輯完成 → UI 播放動畫 → 允許下一步」的方式串接，避免 UI 播一半 AI 已行動。
- 所有動畫都必須可跳過或加速（測試用）。

### 8.5 提示與錯誤

- 非法操作（例如 Check 但需跟注）應禁用按鈕，不要依賴彈窗。
- 若發生邏輯例外（不應發生），顯示「本局結束並回到主選單」並記錄本機 log（見 11.4）。

### 8.6 Odd chip（不可整除籌碼）規則

因為純 Client 且避免爭議，必須在 Spec 中固定：

- 平分底池時若有餘數 1（或多）籌碼，依固定規則發放：從 Button 左手邊起順時針，將餘籌碼依序發給該池的獲勝者。
- 規則需一致且可測。

## 9. 資料模型（邏輯層）

### 9.1 主要資料結構（建議）

- `Card { rank, suit }`
- `Deck { cards[], shuffle(rng), draw() }`
- `Player`
	- `id`, `seatIndex`, `isHuman`, `stack`
	- `holeCards: Card[2] | null`
	- `status: Active | Folded | AllIn | Out`
	- `contributionThisStreet`, `contributionThisHand`
- `Table`
	- `players: Player[9]`（空位可為 null）
	- `buttonSeatIndex`, `smallBlindSeatIndex`, `bigBlindSeatIndex`
	- `communityCards: Card[]`
	- `street: Preflop|Flop|Turn|River|Showdown`
	- `potManager`
	- `actionState`（輪到誰、當前最高下注、最小加注增量、最後有效加注者等）
- `PotManager`
	- `pots: { amount, eligiblePlayerIds[] }[]`
	- `buildPotsFromContributions(players)`

### 9.2 行動與事件

- `Action`
	- `type: Fold|Check|Call|Bet|Raise|AllIn`
	- `amount`（若需要；對 Bet/Raise/All-in/Call）
- `GameEvent`（用於 UI 顯示與回放）
	- `timestamp`, `handId`, `street`, `actorId`, `action`, `deltaStack`, `potDelta`...

### 9.3 手牌評估

- 必須有「給定 7 張牌，回傳最佳 5 張牌型與比較鍵」的純函式（便於測試）。
- 牌型順序：皇家同花順 > 同花順 > 四條 > 葫蘆 > 同花 > 順子 > 三條 > 兩對 > 一對 > 高牌。

## 10. 亂數（RNG）與可測試性

### 10.1 RNG 來源

- 遊戲中所有「會影響結果」的隨機（洗牌、AI 決策中的隨機、隨機人數等）必須使用同一套可注入 RNG。
- 需支援：
	- 隨機模式：使用 `crypto.getRandomValues`（Web）或引擎可用的安全隨機來源（若不可得，退回 `Math.random` 但需在 Spec 明確標註）。
	- 固定種子模式：開發/測試可輸入 seed 以重現牌局。

### 10.2 重現（Replay）能力（本機）

- 至少要能在 Debug 模式輸出：
	- `seed`
	- 本局玩家數與座位
	- 洗牌後牌序（或每次 draw 的牌序）
	- 行動序列
- 不要求 UI 回放，但資料結構需允許將來補上。

## 11. 存檔與設定（純 Client）

### 11.1 本機儲存

- 使用本機儲存（Web：`localStorage`；原生：Creator 對應的本地儲存 API）保存設定。
- 設定項目（至少）：
	- 音量（BGM/SFX）
	- 起始籌碼、盲注（若允許調整）
	- AI 難度
	- AI 思考時間（或加速模式）
	- Debug seed（僅開發模式）

### 11.2 存檔版本

- 本機存檔需有 `schemaVersion`，未來改版可做向下相容或重置。

### 11.3 隱私

- 不上傳任何資料。
- 不收集可識別個資。

### 11.4 Log

- 提供本機 log（可關閉）：
	- 重大錯誤堆疊
	- 每手牌的 seed 與簡要動作

## 12. 例外情境與邊界條件

- 2 人桌（Heads-up）盲注與行動順序需正確：
	- HU 常規：Button 同時是 SB，且 Preflop 由 Button 先行；Postflop 由 BB 先行。
- 全員棄牌：最後未棄牌者立刻獲勝。
- 多人 All-in：直接補牌到 River 並結算所有池。
- 玩家籌碼不足以跟注：視為 All-in call。
- 一局結束後若有人 stack=0：
	- AI 玩家：離桌。
	- 人類玩家：Session 立刻結束（失敗）。
	- 若人類玩家為最後一位留在桌上的玩家：Session 結束（勝利）。

## 13. 音效與視覺（最低要求）

- 牌局關鍵事件需有基本提示：發牌、下注、加注、棄牌、攤牌、贏得底池。
- 不要求華麗特效，但需確保資訊清楚可辨。

## 14. 驗收標準（Acceptance Criteria）

- 每個 Session 開始時，桌上人數必為 2–9 隨機，且恰好 1 位人類玩家（座位隨機），其餘皆 AI。
- 能完整跑完以下情境且不崩潰、不違規：
	- 正常四街下注到攤牌。
	- Preflop 或任一街全員棄牌結束。
	- 形成至少 1 個邊池（2 人 All-in + 第三人跟注）。
	- 形成多個邊池（至少 3 層投入）。
	- Heads-up 正確盲注與行動順序。
- 手牌比較正確（可用固定案例測試）。
- 在固定 seed 下，同一局（含 AI 行動）可重現相同行為與結果。
- UI 不出現「輪到誰不明」「按了無反應」或非法按鈕可點。
- AI 玩家籌碼歸零會離桌；人類玩家籌碼歸零會結束遊戲並顯示失敗。
- 當只剩人類玩家留在桌上時會結束遊戲並顯示勝利。

## 15. 已定案項目

1. 人類玩家座位：每個 Session 開始時隨機座位。
2. Button 指派：第一手隨機、之後每手順時針輪轉。
3. Odd chip 規則：從 Button 左手邊起順時針，將餘籌碼依序發給該池獲勝者。
4. 盲注升級：第一版採固定盲注。
5. 破產與勝負：
	- 人類玩家破產（stack=0）：Session 結束（失敗）。
	- AI 玩家破產（stack=0）：離桌。
	- 若人類玩家為最後一位留在桌上的玩家：Session 結束（勝利）。

