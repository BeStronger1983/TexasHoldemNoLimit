
# 開發 Tasks（依 `docs/Spec.md`）

> 專案：無限注德州撲克（No-Limit Texas Hold'em）
>
> 引擎：Cocos Creator 3.8.7 / TypeScript
>
> 原則：作者端程式碼放 `assets/Scripts/**`；`library/`、`temp/` 等生成內容不手改。

## 標記規則

- **[Code]**：只需要改/新增 TypeScript（放在 `assets/Scripts/`）
- **[Human]**：必須由人類在 Cocos Creator 編輯器中修改（Scene / Prefab / 節點佈局 / 連結 Component 參考）
- **[Config]**：可配置資料（集中管理）
- **[Test]**：可重現/可驗收的測試案例或 Debug 工具

## DoD（Definition of Done）

 - 不要求結果可重現（可接受每次執行結果不同）。
- 達成 Spec 驗收情境：正常四街、任一街全員棄牌、至少 1 個邊池、至少 3 層邊池、Heads-up 正確順序（Spec §14）。
- UI 不允許非法操作：按鈕狀態正確（Spec §8.5）。

---

## 測試入口原則（Scene-first：每個 Task 都能在 Scene 立即驗收）

為了避免「Script 全部寫完才開始做 Scene」，本文件把每個 Task 的驗收都改成：**一定要能在 Cocos Creator 的某個 Scene 裡跑起來**（最少用 `console.log` 驗證）。

### 共通約定（建議照做，讓每個 Task 都能快速驗收）

- **[Human][Test]** 先建立一個可重複使用的 Debug Scene：`DebugSandbox`
	- 內容極簡：一個掛腳本的 `Runner` 節點即可（UI 可有可無；沒有 UI 也可用 `start()` 自動跑）。
	- 之後每個 Task 若需要獨立場景，也可建立 `DebugRng` / `DebugModel` / `DebugHandFlow`… 等，但**最少要有一個能跑的 Scene**。

- **[Code][Test]** 每個里程碑的「純邏輯」都要配一個對應的 Runner 腳本（放 `assets/Scripts/**`）
	- 範例命名：`DebugRngRunner`、`DebugDeckRunner`、`DebugPotRunner`、`DebugHandFlowRunner`…
	- Runner 的責任只有：建立測試資料、呼叫邏輯、把結果 `console.log`（必要時更新一個 Label）。

- **Log 規範（方便比對可重現性）**

- **Log 規範（方便比對可重現性；對照：Spec §10.1、§10.2、§11.4）**
	- 每次跑都要先印：`[TEST] <TaskId> schemaVersion=<schemaVersion>`
	- 所有 RNG 相關輸出都要可複製比對（例如固定印前 N 個數、抽牌序列、座位分配）。

> 注意：Scene/Prefab/節點佈局仍由人類在 Editor 內建立與綁定；本文件會把每個 Task 的「需要哪個 Scene」與「如何驗收」寫清楚。

---

## Milestone 0：專案骨架與配置

### T0.1 設定與常數集中管理（盲注/起始籌碼/規則開關）

- [x] **[Code][Config]** 建立 `GameConfig`（例如 `assets/Scripts/config/GameConfig.ts`）
	- `startingStack`（預設 1000）
	- `smallBlind` / `bigBlind`（預設 5 / 10）
	- `ante`（預設 0，可開關）
	- `burnCardEnabled`（預設 true）
	- `reopenOnShortAllinRaise`（預設 false，Spec §5.7）
	- `aiDifficulty`、`aiThinkTimeMsMin/Max`、`aiThinkTimeEnabled`（Spec §7.2.5）
	- `animationSpeed` 或 `skipAnimations`（Spec §8.4）
	- `logEnabled`（Spec §11.4）
	- `schemaVersion`（Spec §11.2）
- ✅ 驗收：所有規則參數僅從 `GameConfig` 讀取，不散落硬編碼。
	- ✅ 驗收（Scene）：在 `DebugSandbox` 跑 `DebugConfigRunner`，印出 `GameConfig` 全部欄位，確認數值只從 `GameConfig` 來（之後任何用到的系統也能一併印出核對）。

### T0.2 本機設定存取（local storage）

- [x] **[Code]** `SettingsService`：讀寫設定、版本升級策略（不相容可重置）
- ✅ 驗收：可保存/載入音量、AI 難度、思考時間、盲注/起始籌碼（Spec §11.1）。
	- ✅ 驗收（Scene）：在 `DebugSandbox` 提供一次「寫入→讀回」的測試（至少印出寫入前/後的 key-values）。
		-（對照：Spec §11.1、§11.2）

### T0.3 DebugSandbox Scene（讓後續每個 Task 都能先跑 log）

- [x] **[Human][Test]** 建立 `DebugSandbox` Scene（可放在 `assets/Scenes/DebugSandbox.scene`）
	- 建立空節點 `Runner`（掛任何 Debug Runner 用）
- [x] **[Code][Test]** 建立 `DebugConfigRunner`
	- 進入 Scene 後自動 `console.log` 目前 `GameConfig` 與 `SettingsService` 載入值
- ✅ 驗收（Scene）：打開 `DebugSandbox` → Play → Console 看到設定值被印出（可重複）。
	- ✅ 驗收（Scene）：打開 `DebugSandbox` → Play → Console 看到設定值被印出（可重複）（對照：Spec §11.1、§11.2、§11.4）。

---

## Milestone 1：核心資料模型 + RNG + 可重現性

### T1.0 Debug Scenes（Milestone 1 專用）

- [x] **[Human][Test]** 建立下列 Debug Scenes（可先只做 `DebugRng`，其他可視需要追加）：
	- `DebugRng`：只驗 RNG（序列）
	- `DebugModel`：驗 `Card/Deck/Player/Table` 的資料正確性
	- `DebugSession`：驗入座/hand 初始化（座位、button、盲注、籌碼變化）
- ✅ 驗收（Scene）：每個 Scene Play 後至少能印出一行 `[TEST] <TaskId> ...`，避免空場景。
	- ✅ 驗收（Scene）：每個 Scene Play 後至少能印出一行 `[TEST] <TaskId> ...`，避免空場景（對照：Spec §10.2、§14）。

### T1.1 RNG 抽象與實作

- [x] **[Code]** 定義 `IRng`（例如 `nextInt(maxExclusive)`、`nextFloat()`）
- [x] **[Code]** 實作：
	- `SecureRng`（Web 用 `crypto.getRandomValues`；不可得則退回 `Math.random`，但要能被測試模式替換）
- ✅ 驗收：所有會影響結果的隨機（入局人數、座位、洗牌、AI 決策擾動）都只走同一個可注入 RNG（Spec §10.1）。
	- ✅ 驗收（Scene）：在 `DebugRng` 掛 `DebugRngRunner`
		- 跑一次 `SecureRng`：印出前 20 個 `nextInt(52)` 與前 5 個 `nextFloat()`（對照：Spec §10.1）。

### T1.2 基礎資料結構（純邏輯）

- [x] **[Code]** `Card` / `Deck`（52 張、洗牌、draw）
- [x] **[Code]** `Player` / `PlayerStatus`（Active/Folded/AllIn/Out）
- [x] **[Code]** `Action` / `ActionType`（Fold/Check/Call/Bet/Raise/AllIn）
- [x] **[Code]** `Table`（9 seats，可為空；communityCards；button/sb/bb；street；actionState；potManager）
- [x] **[Code]** `GameEvent`（供 UI 顯示與 Debug log，Spec §9.2、§10.2、§11.4）
- ✅ 驗收：模型層不依賴 Cocos 節點；可在純 TS 環境被呼叫。
	- ✅ 驗收（Scene）：在 `DebugModel` 掛 Runner 並印出
		- 新 Deck 洗牌後前 10 張牌（或 draw 序列）
		- 建 2–3 個 Player 與 Table（9 seats）後，印出 seats/狀態/籌碼/街別初始值
		- 確認 Runner 不需要任何 Node 參考也可運作（只有 `console.log` 也算）（對照：Spec §9.1、§9.2）。

### T1.3 Session/Hand 初始化（入座與離桌）

- [x] **[Code]** Session 開始：隨機 N∈[2,9]；恰好 1 人類；座位隨機；AI 命名（Spec §5.1、§14）
- [x] **[Code]** Hand 開始：Button（首手隨機；之後順時針），扣 ante、扣盲注（Spec §6.1）
- [x] **[Code]** 籌碼歸零：AI 離桌；人類歸零 Session 結束失敗；只剩人類則勝利（Spec §6.1 step 11–12、§14）

- ✅ 驗收（Scene）：在 `DebugSession` 掛 Runner，印出
		- N、人類座位 index、每位玩家 name/stack/seat
		- 首手 button/sb/bb，並印出扣盲注後 stack
		-（對照：Spec §5.1、§6.1、§12、§14）。

### T1.4 Debug/Replay 記錄輸出

- [x] **[Code][Test]** Debug 模式輸出（可寫到 console 或本機檔案/儲存）：
	- 玩家數與座位/人類座位
	- 洗牌後牌序或每次 draw 序列
	- 行動序列（含金額）

- ✅ 驗收（Scene）：在 `DebugSandbox` 或 `DebugSession` 透過 Runner
	- 產生一份可複製的 replay log（入座 + 抽牌序列 + action 序列）
	-（不要求重播一致；對照：Spec §11.4）。

---

## Milestone 2：狀態機與下注/邊池/結算（核心規則）

### T2.0 Debug Scenes（Milestone 2 專用）

- [ ] **[Human][Test]** 建立下列 Debug Scenes（可逐步建立，不要求一次到位）：
	- `DebugHandFlow`：跑一手從發牌到結束（先不接 UI，只印狀態與事件）
	- `DebugBetting`：只跑一輪下注與合法動作集
	- `DebugPot`：只驗 side pots 與 eligible
	- `DebugEvaluate`：只驗 `evaluate7` 固定案例
	- ✅ 驗收（Scene）：每個 Scene Play 後能印出清楚的階段標記（例如 `state=DealFlop`）（對照：Spec §6.2、§8.4）。

### T2.1 牌局狀態機（State Machine）

- [ ] **[Code]** 明確狀態列舉與轉移（Spec §6.2）：
	- `Boot` → `MainMenu` → `TableSetup` → `PostingBlinds` → `DealHoleCards` →
		`BettingPreflop` → `DealFlop` → `BettingFlop` → `DealTurn` → `BettingTurn` →
		`DealRiver` → `BettingRiver` → `Showdown` → `Payout` → `HandSummary` → `NextHandOrExit`
- [ ] **[Code]** 狀態必須有 guards / 退出條件 / 事件觸發點，避免 UI/AI/動畫互相搶（Spec §6.2、§8.4）
- ✅ 驗收：任何一局不會卡死（無可行事件時仍能前進或安全結束回主選單）。
	- ✅ 驗收（Scene）：在 `DebugHandFlow` 跑 1 手牌局
		- console 逐步印出狀態轉移序列（至少涵蓋到 Flop/Turn/River 或提早結束）
		- 若偵測到無可行事件，必須印出原因並安全結束（回到 `MainMenu` 可留到 Milestone 4，但 Debug Scene 不能卡死）（對照：Spec §6.2、§8.5）。

### T2.2 發牌流程（含燒牌可配置）

- [ ] **[Code]** 新 Deck、洗牌、依順時針發 2 張手牌（Spec §5.2、§5.4）
- [ ] **[Code]** Flop/Turn/River 前燒牌（預設開啟，可配置）
- ✅ 驗收：公共牌張數正確；burn 開關會影響 draw 序列且可重現。
	- ✅ 驗收（Scene）：在 `DebugHandFlow`
		- burn 開：印出 burn 的牌 + flop/turn/river
		- burn 關：再跑一次，印出另一組公共牌（通常不同；對照：Spec §5.4）。

### T2.3 行動順序（含 Heads-up 特例）

- [ ] **[Code]** Preflop：從 BB 左手邊（UTG）開始（Spec §5.5）
- [ ] **[Code]** Postflop：從 BTN 左手邊第一位仍在局玩家開始（Spec §5.5）
- [ ] **[Code]** Heads-up 正確規則（Spec §12）：
	- Button 同時是 SB
	- Preflop：Button 先行
	- Postflop：BB 先行
- ✅ 驗收：固定座位下用測例驗證每一街第一位行動者正確。
	- ✅ 驗收（Scene）：在 `DebugBetting` 以固定座位配置印出每一街第一位行動者 seat index
		- 一般 3+ 人：preflop=UTG；postflop=BTN 左手第一位未棄牌
		- Heads-up：印出 button=SB；preflop 先行者=button；postflop 先行者=BB（對照：Spec §5.5、§12）。

### T2.4 下注規則與最小加注（No-Limit）

- [ ] **[Code]** 合法動作集計算：Fold/Check/Call/Bet/Raise/All-in（Spec §5.5、§7.1、§8.3）
- [ ] **[Code]** 金額規則：
	- `toCall`、`currentBet`、`lastRaiseIncrement`、`minRaise` 計算
	- All-in 作為 Bet/Raise/Call 特例
	- All-in 不足最小加注增量時的 reopen 行為（預設不 reopen，Spec §5.7）
- [ ] **[Code]** 一輪下注結束條件（Spec §5.6）：
	- 只剩 1 位未棄牌
	- 所有未 all-in 者行動完成且對齊最高下注，且最後加注者後面都已回應
	- 全員 all-in 則跳過後續下注直補牌
- ✅ 驗收：任意街都能正確結束並進入下一狀態，不多走/不漏走。
	- ✅ 驗收（Scene）：在 `DebugBetting` 提供 3 組可重現腳本（固定 action list）
		- 只剩 1 人未棄牌立即結束
		- 正常 bet/raise/call 對齊後結束
		- 全員 all-in 直接補牌到攤牌（中間不再詢問動作）（對照：Spec §5.5、§5.6、§5.7、§12）。

### T2.5 邊池（Side Pot）計算

- [ ] **[Code]** `PotManager.buildPotsFromContributions(players)`（Spec §5.7、§9.1）
	- 依 `contributionThisHand` 分層切池
	- 每池 eligible 玩家：對該層有投入且未棄牌
- ✅ 驗收：至少 3 層投入時 pots 金額與 eligible 正確。
	- ✅ 驗收（Scene）：在 `DebugPot` 跑固定案例（直接塞 contributions），印出
		- 每個 pot：amount、eligible seats
		- 至少 3 層（例如 30/70/120）切出 3 個 pots，且 eligible 正確（對照：Spec §5.7、§9.1）。

### T2.6 手牌評估（純函式）

- [ ] **[Code]** `evaluate7(cards: Card[7]) -> HandRank`（可比較鍵）
- [ ] **[Code][Test]** 固定案例測試：涵蓋 9 種牌型與 kicker 比較（Spec §9.3、§14）
- ✅ 驗收：測例全過；同牌型比較結果正確。
	- ✅ 驗收（Scene）：在 `DebugEvaluate` Play 後跑固定案例清單
		- 每個案例印出：7 張牌、牌型名稱、比較鍵（或可比較值）、是否通過
		- 任何失敗要印出期望/實際（對照：Spec §9.3、§14）。

### T2.7 攤牌與派彩（含 Odd chip 規則）

- [ ] **[Code]** River 後仍 ≥2 人未棄牌進入 Showdown（Spec §5.8）
- [ ] **[Code]** 逐池比牌、平分底池
- [ ] **[Code]** Odd chip 規則（Spec §8.6、§15）：
	- 由 Button 左手邊起順時針，把餘籌碼依序給該池獲勝者
- ✅ 驗收：不可整除時餘籌碼分配可重現且符合規則。
	- ✅ 驗收（Scene）：在 `DebugHandFlow` 或 `DebugPot` 跑固定案例
		- 產生 odd chip（例如 pot=101 分 2 人）
		- 印出從 BTN 左手邊起順時針分配順序與最後每人拿到的籌碼（對照：Spec §8.6、§15、§14）。

---

## Milestone 3：AI（Bots）

### T3.0 Debug Scenes（Milestone 3 專用）

- [ ] **[Human][Test]** 建立 `DebugAI` Scene
	- Runner 能跑 N 次決策並印出（不必接完整牌桌 UI）
	- ✅ 驗收（Scene）：Play 後印出至少 1 次 AI 決策（action + amount）（對照：Spec §7.2.1、§7.2.2、§10.1）。

### T3.1 AI 難度與決策介面

- [ ] **[Code][Config]** 2–3 檔難度配置（Spec §7.2.1）
- [ ] **[Code]** `BotDecisionInput`：手牌/公共牌/位置/street/toCall/minRaise/pot/effective stack/歷史下注（Spec §7.2.2）

- ✅ 驗收（Scene）：在 `DebugAI` 對同一 `BotDecisionInput` 連跑 10 次
	- 輸出皆為合法動作（對照：Spec §7.2.1、§14）。

### T3.2 Preflop 起手牌簡化表（bucket）

- [ ] **[Code]** 依位置調整 open/call/3bet 機率（Spec §7.2.3）
- ✅ 驗收：不會產生非法動作；下注金額符合最小加注與籌碼限制。
	- ✅ 驗收（Scene）：在 `DebugAI` 產生多組位置/stack/toCall/minRaise 情境，印出 AI 選擇並驗證合法性（不合法要直接 assert/throw 並印出情境）。

### T3.3 Postflop 強度估計 + 底池賠率 + 擾動

- [ ] **[Code]** made hand / draw（同花聽牌、順子聽牌）簡化分類（Spec §7.2.3）
- [ ] **[Code]** bet sizing：33% / 50% / 75% / Pot 混合（Spec §7.2.4）
- [ ] **[Code]** 全下條件（強牌/短碼/半詐唬小機率）
- ✅ 驗收：長時間跑多手牌不會卡死，且動作合法。
	- ✅ 驗收（Scene）：在 `DebugAI`（或 `DebugHandFlow`）跑 50–200 次簡化 hand loop
		- 每手印出簡短摘要（street、action、amount），最後印出「無卡死/無非法動作」總結（對照：Spec §7.2.1、§5.6、§14）。

### T3.4 AI 思考時間

- [ ] **[Code][Config]** 300–1200ms 隨機延遲；可關閉/縮短（Spec §7.2.5）
- ✅ 驗收：加速模式下行為仍可重現（延遲不影響隨機序列）。
	- ✅ 驗收（Scene）：在 `DebugAI` 開/關延遲各跑一次
		- 兩次的「決策序列」必須一致（延遲只能影響時間，不影響 RNG 序列）（對照：Spec §7.2.5、§10.1）。

---

## Milestone 4：UI / UX（最低可玩集）

> 注意：依專案規範，Scene/Prefab/節點佈局由人類修改；腳本放 `assets/Scripts/`。

### T4.1 主選單 Scene

- [ ] **[Human]** 建立 `MainMenu` Scene（Spec §8.1）
	- 按鈕：開始遊戲、設定、離開
- [ ] **[Code]** `MainMenuController`：按鈕事件（開始→進桌；離開→桌機退出；設定→開啟設定 UI）
- ✅ 驗收：可從主選單進入牌桌 Scene。
	- ✅ 驗收（Scene）：`MainMenu` Play 後點「開始」進 `Table`；若尚未完成完整牌局，可先進到 `Table` 並印出「Table Scene Loaded」。
		-（對照：Spec §8.1）

### T4.2 牌桌 Scene（9 座位 + 公共牌 + 底池 + 操作區）

- [ ] **[Human]** 建立 `Table` Scene（Spec §8.1、§8.2、§8.3）
	- 9 個座位節點（Seat0..Seat8）：名稱、籌碼、狀態、當街下注額、手牌區
	- 公共牌區（5 張位）
	- 底池/邊池顯示
	- 事件/提示文字區
	- 人類操作區：Fold、Check/Call、All-in、Bet/Raise（滑桿 + 確認）

- [ ] **[Code]** `TableViewBinder`（或 Presenter）
	- 把 `Table` 模型狀態更新到 UI
	- 顯示輪到誰（turn indicator）
	- AI 手牌預設遮住；攤牌才揭示（Spec §8.2）

- ✅ 驗收：2–9 人隨機入局時，空位顯示一致；人類座位隨機且可操作。
	- ✅ 驗收（Scene）：`Table` Play 後
		- 先只要求印出（或顯示）座位占用狀態與人類座位 index
		- 若 `TableViewBinder` 尚未完成，可先用 `console.log` 逐座位輸出（確保 Scene 先做起來）（對照：Spec §8.2、§14）。

### T4.3 人類操作區：合法動作與金額約束

- [ ] **[Code]** 行動面板狀態計算：
	- `Check/Call` 文案切換
	- 需跟注額（To Call）、最小加注（Min Raise）、底池（Pot）顯示（Spec §8.3）
	- 禁用非法按鈕（Spec §8.5）
- [ ] **[Human]** 在 Scene 內把按鈕/滑桿/Label 參考拖到腳本欄位
- ✅ 驗收：需跟注 > 0 時不能 Check；Raise 低於 min raise 時被禁用或自動修正（All-in 例外）。
	- ✅ 驗收（Scene）：在 `Table`（或獨立 `DebugUIActionPanel` Scene）
		- 注入 3 組 action state（toCall=0 / >0 / all-in 壓力）
		- UI 按鈕 enabled 與文案切換正確，且 console 印出目前可用動作清單（對照：Spec §7.1、§8.3、§8.5）。

### T4.4 動畫/節奏控制（可跳過/加速）

- [ ] **[Code][Config]** 動畫播放門檻：邏輯完成 → UI 動畫 → 才允許下一步（Spec §8.4）
- [ ] **[Code]** 提供跳過/加速開關（測試用）
- ✅ 驗收：跳過動畫時流程仍正確，且不會讓 AI/UI 互相搶狀態。
	- ✅ 驗收（Scene）：在 `Table` 開/關 skip/加速各跑一次
		- 印出每個 state 完成時間戳與下一步觸發點，確認不會重入/跳步（對照：Spec §8.4、§6.2）。

### T4.5 錯誤處理與回主選單

- [ ] **[Code]** 捕捉不應發生的邏輯例外：顯示提示並回主選單，並記 log（Spec §8.5、§11.4）
- ✅ 驗收：故意注入錯誤時可安全返回，不會壞存檔。
	- ✅ 驗收（Scene）：在 `DebugSandbox` 提供一個「注入錯誤」開關（例如 throw）
		- 看到錯誤提示/log，並能回到 `MainMenu`（至少 scene 切換成功）（對照：Spec §8.5、§11.4）。

---

## Milestone 5：驗收情境與回歸（可重現）

### T5.1 驗收腳本/模式

### T5.1 驗收腳本/模式

- [ ] **[Code][Test]** 提供「Debug 模式一鍵開局」：直接開始一手/一個 session

	- ✅ 驗收（Scene）：在 `MainMenu` 或 `DebugSandbox`
		- 一鍵開局 → 自動跑到 Hand Summary（對照：Spec §14）。

### T5.2 Spec 驗收情境覆蓋

- [ ] **[Test]** 正常四街下注到攤牌（含至少 1 次 bet/raise）
- [ ] **[Test]** Preflop 或任一街全員棄牌結束
- [ ] **[Test]** 至少 1 個邊池（2 人 all-in + 第三人跟注）
- [ ] **[Test]** 多個邊池（至少 3 層投入）
- [ ] **[Test]** Heads-up 正確盲注與行動順序
	- ✅ 驗收（Scene）：每一條情境都要能在 `DebugHandFlow`（純 log）與 `Table`（帶 UI）各跑一次；至少先做到 DebugHandFlow 可重現（對照：Spec §14）。

### T5.3 長跑穩定性

- [ ] **[Test]** 跑 200+ 手牌（可加速）不崩潰、不卡死、stack/離桌/勝負判定合理

