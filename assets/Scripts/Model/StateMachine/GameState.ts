export enum GameState {
	/** App 啟動後的初始化階段：讀設定/初始化 RNG/建立必要服務。 */
	Boot = 'Boot',
	/** 主選單：等待開始遊戲/離開/進設定等操作。 */
	MainMenu = 'MainMenu',
	/** 建立桌面與玩家：人數、座位、人類座位、起始籌碼、Button/SB/BB 指派。 */
	TableSetup = 'TableSetup',
	/** 扣除 ante（若啟用）與盲注（SB/BB），並記錄投入金額供底池/邊池計算。 */
	PostingBlinds = 'PostingBlinds',
	/** 洗牌並發每位在局玩家 2 張手牌（Hole Cards）。 */
	DealHoleCards = 'DealHoleCards',
	/** Preflop 下注輪（含 Heads-up 特例的行動順序）。 */
	BettingPreflop = 'BettingPreflop',
	/** 發 Flop（通常含燒牌）：翻開 3 張公共牌。 */
	DealFlop = 'DealFlop',
	/** Flop 下注輪：從 BTN 左手邊第一位仍在局玩家開始行動。 */
	BettingFlop = 'BettingFlop',
	/** 發 Turn（通常含燒牌）：翻開第 4 張公共牌。 */
	DealTurn = 'DealTurn',
	/** Turn 下注輪。 */
	BettingTurn = 'BettingTurn',
	/** 發 River（通常含燒牌）：翻開第 5 張公共牌。 */
	DealRiver = 'DealRiver',
	/** River 最後一輪下注。 */
	BettingRiver = 'BettingRiver',
	/** 攤牌與比牌：決定每個池（主池/邊池）的贏家。 */
	Showdown = 'Showdown',
	/** 派彩：依底池/邊池與 odd chip 規則分配籌碼並更新 stack。 */
	Payout = 'Payout',
	/** 本手牌摘要：顯示結果（誰贏、贏多少、是否攤牌等）。 */
	HandSummary = 'HandSummary',
	/** 判斷下一手或結束 Session：處理破產/離桌、Button 輪轉、進入下一手或回主選單。 */
	NextHandOrExit = 'NextHandOrExit',
}
