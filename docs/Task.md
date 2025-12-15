
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

- 固定 seed 下可重現：洗牌、入座、人類座位、AI 行為與結果一致（Spec §10、§14）。
- 達成 Spec 驗收情境：正常四街、任一街全員棄牌、至少 1 個邊池、至少 3 層邊池、Heads-up 正確順序（Spec §14）。
- UI 不允許非法操作：按鈕狀態正確（Spec §8.5）。

---

## Milestone 0：專案骨架與配置

### T0.1 設定與常數集中管理（盲注/起始籌碼/規則開關）

- [ ] **[Code][Config]** 建立 `GameConfig`（例如 `assets/Scripts/config/GameConfig.ts`）
	- `startingStack`（預設 1000）
	- `smallBlind` / `bigBlind`（預設 5 / 10）
	- `ante`（預設 0，可開關）
	- `burnCardEnabled`（預設 true）
	- `reopenOnShortAllinRaise`（預設 false，Spec §5.7）
	- `aiDifficulty`、`aiThinkTimeMsMin/Max`、`aiThinkTimeEnabled`（Spec §7.2.5）
	- `animationSpeed` 或 `skipAnimations`（Spec §8.4）
	- `debugSeedEnabled` / `debugSeed`（Spec §10）
	- `logEnabled`（Spec §11.4）
	- `schemaVersion`（Spec §11.2）
- ✅ 驗收：所有規則參數僅從 `GameConfig` 讀取，不散落硬編碼。

### T0.2 本機設定存取（local storage）

- [ ] **[Code]** `SettingsService`：讀寫設定、版本升級策略（不相容可重置）
- ✅ 驗收：可保存/載入音量、AI 難度、思考時間、盲注/起始籌碼（Spec §11.1）。

---

## Milestone 1：核心資料模型 + RNG + 可重現性

### T1.1 RNG 抽象與實作

- [ ] **[Code]** 定義 `IRng`（例如 `nextInt(maxExclusive)`、`nextFloat()`）
- [ ] **[Code]** 實作：
	- `SeededRng`（固定 seed 可重現）
	- `SecureRng`（Web 用 `crypto.getRandomValues`；不可得則退回 `Math.random`，但要能被測試模式替換）
- ✅ 驗收：所有會影響結果的隨機（入局人數、座位、洗牌、AI 決策擾動）都只走同一個可注入 RNG（Spec §10.1）。

### T1.2 基礎資料結構（純邏輯）

- [ ] **[Code]** `Card` / `Deck`（52 張、洗牌、draw）
- [ ] **[Code]** `Player` / `PlayerStatus`（Active/Folded/AllIn/Out）
- [ ] **[Code]** `Action` / `ActionType`（Fold/Check/Call/Bet/Raise/AllIn）
- [ ] **[Code]** `Table`（9 seats，可為空；communityCards；button/sb/bb；street；actionState；potManager）
- [ ] **[Code]** `GameEvent`（供 UI 顯示與 Debug log，Spec §9.2、§10.2、§11.4）
- ✅ 驗收：模型層不依賴 Cocos 節點；可在純 TS 環境被呼叫。

### T1.3 Session/Hand 初始化（入座與離桌）

- [ ] **[Code]** Session 開始：隨機 N∈[2,9]；恰好 1 人類；座位隨機；AI 命名（Spec §5.1、§14）
- [ ] **[Code]** Hand 開始：Button（首手隨機；之後順時針），扣 ante、扣盲注（Spec §6.1）
- [ ] **[Code]** 籌碼歸零：AI 離桌；人類歸零 Session 結束失敗；只剩人類則勝利（Spec §6.1 step 11–12、§14）
- ✅ 驗收：固定 seed 下，每次 Session 產生同樣的入座結果。

### T1.4 Debug/Replay 記錄輸出

- [ ] **[Code][Test]** Debug 模式輸出（可寫到 console 或本機檔案/儲存）：
	- `seed`
	- 玩家數與座位/人類座位
	- 洗牌後牌序或每次 draw 序列
	- 行動序列（含金額）
- ✅ 驗收：可用同一 seed 重播得到相同行為與結果（Spec §10.2、§14）。

---

## Milestone 2：狀態機與下注/邊池/結算（核心規則）

### T2.1 牌局狀態機（State Machine）

- [ ] **[Code]** 明確狀態列舉與轉移（Spec §6.2）：
	- `Boot` → `MainMenu` → `TableSetup` → `PostingBlinds` → `DealHoleCards` →
		`BettingPreflop` → `DealFlop` → `BettingFlop` → `DealTurn` → `BettingTurn` →
		`DealRiver` → `BettingRiver` → `Showdown` → `Payout` → `HandSummary` → `NextHandOrExit`
- [ ] **[Code]** 狀態必須有 guards / 退出條件 / 事件觸發點，避免 UI/AI/動畫互相搶（Spec §6.2、§8.4）
- ✅ 驗收：任何一局不會卡死（無可行事件時仍能前進或安全結束回主選單）。

### T2.2 發牌流程（含燒牌可配置）

- [ ] **[Code]** 新 Deck、洗牌、依順時針發 2 張手牌（Spec §5.2、§5.4）
- [ ] **[Code]** Flop/Turn/River 前燒牌（預設開啟，可配置）
- ✅ 驗收：公共牌張數正確；burn 開關會影響 draw 序列且可重現。

### T2.3 行動順序（含 Heads-up 特例）

- [ ] **[Code]** Preflop：從 BB 左手邊（UTG）開始（Spec §5.5）
- [ ] **[Code]** Postflop：從 BTN 左手邊第一位仍在局玩家開始（Spec §5.5）
- [ ] **[Code]** Heads-up 正確規則（Spec §12）：
	- Button 同時是 SB
	- Preflop：Button 先行
	- Postflop：BB 先行
- ✅ 驗收：固定座位下用測例驗證每一街第一位行動者正確。

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

### T2.5 邊池（Side Pot）計算

- [ ] **[Code]** `PotManager.buildPotsFromContributions(players)`（Spec §5.7、§9.1）
	- 依 `contributionThisHand` 分層切池
	- 每池 eligible 玩家：對該層有投入且未棄牌
- ✅ 驗收：至少 3 層投入時 pots 金額與 eligible 正確。

### T2.6 手牌評估（純函式）

- [ ] **[Code]** `evaluate7(cards: Card[7]) -> HandRank`（可比較鍵）
- [ ] **[Code][Test]** 固定案例測試：涵蓋 9 種牌型與 kicker 比較（Spec §9.3、§14）
- ✅ 驗收：測例全過；同牌型比較結果正確。

### T2.7 攤牌與派彩（含 Odd chip 規則）

- [ ] **[Code]** River 後仍 ≥2 人未棄牌進入 Showdown（Spec §5.8）
- [ ] **[Code]** 逐池比牌、平分底池
- [ ] **[Code]** Odd chip 規則（Spec §8.6、§15）：
	- 由 Button 左手邊起順時針，把餘籌碼依序給該池獲勝者
- ✅ 驗收：不可整除時餘籌碼分配可重現且符合規則。

---

## Milestone 3：AI（Bots）

### T3.1 AI 難度與決策介面

- [ ] **[Code][Config]** 2–3 檔難度配置（Spec §7.2.1）
- [ ] **[Code]** `BotDecisionInput`：手牌/公共牌/位置/street/toCall/minRaise/pot/effective stack/歷史下注（Spec §7.2.2）
- ✅ 驗收：同一難度 + 同一 seed 下 AI 決策一致。

### T3.2 Preflop 起手牌簡化表（bucket）

- [ ] **[Code]** 依位置調整 open/call/3bet 機率（Spec §7.2.3）
- ✅ 驗收：不會產生非法動作；下注金額符合最小加注與籌碼限制。

### T3.3 Postflop 強度估計 + 底池賠率 + 擾動

- [ ] **[Code]** made hand / draw（同花聽牌、順子聽牌）簡化分類（Spec §7.2.3）
- [ ] **[Code]** bet sizing：33% / 50% / 75% / Pot 混合（Spec §7.2.4）
- [ ] **[Code]** 全下條件（強牌/短碼/半詐唬小機率）
- ✅ 驗收：長時間跑多手牌不會卡死，且動作合法。

### T3.4 AI 思考時間

- [ ] **[Code][Config]** 300–1200ms 隨機延遲；可關閉/縮短（Spec §7.2.5）
- ✅ 驗收：加速模式下行為仍可重現（延遲不影響隨機序列）。

---

## Milestone 4：UI / UX（最低可玩集）

> 注意：依專案規範，Scene/Prefab/節點佈局由人類修改；腳本放 `assets/Scripts/`。

### T4.1 主選單 Scene

- [ ] **[Human]** 建立 `MainMenu` Scene（Spec §8.1）
	- 按鈕：開始遊戲、設定、離開
- [ ] **[Code]** `MainMenuController`：按鈕事件（開始→進桌；離開→桌機退出；設定→開啟設定 UI）
- ✅ 驗收：可從主選單進入牌桌 Scene。

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

### T4.3 人類操作區：合法動作與金額約束

- [ ] **[Code]** 行動面板狀態計算：
	- `Check/Call` 文案切換
	- 需跟注額（To Call）、最小加注（Min Raise）、底池（Pot）顯示（Spec §8.3）
	- 禁用非法按鈕（Spec §8.5）
- [ ] **[Human]** 在 Scene 內把按鈕/滑桿/Label 參考拖到腳本欄位
- ✅ 驗收：需跟注 > 0 時不能 Check；Raise 低於 min raise 時被禁用或自動修正（All-in 例外）。

### T4.4 動畫/節奏控制（可跳過/加速）

- [ ] **[Code][Config]** 動畫播放門檻：邏輯完成 → UI 動畫 → 才允許下一步（Spec §8.4）
- [ ] **[Code]** 提供跳過/加速開關（測試用）
- ✅ 驗收：跳過動畫時流程仍正確，且不會讓 AI/UI 互相搶狀態。

### T4.5 錯誤處理與回主選單

- [ ] **[Code]** 捕捉不應發生的邏輯例外：顯示提示並回主選單，並記 log（Spec §8.5、§11.4）
- ✅ 驗收：故意注入錯誤時可安全返回，不會壞存檔。

---

## Milestone 5：驗收情境與回歸（可重現）

### T5.1 固定 seed 的驗收腳本/模式

- [ ] **[Code][Test]** 提供「Debug 模式一鍵開局」：輸入 seed → 直接開始一手/一個 session
- ✅ 驗收：同 seed 每次結果一致（Spec §14）。

### T5.2 Spec 驗收情境覆蓋

- [ ] **[Test]** 正常四街下注到攤牌（含至少 1 次 bet/raise）
- [ ] **[Test]** Preflop 或任一街全員棄牌結束
- [ ] **[Test]** 至少 1 個邊池（2 人 all-in + 第三人跟注）
- [ ] **[Test]** 多個邊池（至少 3 層投入）
- [ ] **[Test]** Heads-up 正確盲注與行動順序

### T5.3 長跑穩定性

- [ ] **[Test]** 跑 200+ 手牌（可加速）不崩潰、不卡死、stack/離桌/勝負判定合理

