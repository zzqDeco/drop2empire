package domain

import "time"

// Corporate wallets are not players: they cannot authenticate, gather, or craft.
type TradingWallet struct {
	Handle string           `json:"handle"`
	Cash   int64            `json:"cash"`
	Escrow int64            `json:"escrow"`
	Stock  map[string]int64 `json:"stock"`
	Frozen map[string]int64 `json:"frozen"`
}

type EconomyState struct {
	NextRecordSeq int64               `json:"nextRecordSeq"`
	Version       int                 `json:"version"`
	Reserve       int64               `json:"reserve"`
	Issued        int64               `json:"issued"`
	Cancelled     int64               `json:"cancelled"`
	Public        TradingWallet       `json:"public"`
	Policies      []MonetaryPolicy    `json:"policies"`
	Companies     map[string]*Company `json:"companies"`
	LastTick      time.Time           `json:"lastTick"`
}

type MonetaryPolicy struct {
	ID       string    `json:"id"`
	Action   string    `json:"action"`
	Amount   int64     `json:"amount"`
	Item     string    `json:"item"`
	Quantity int64     `json:"quantity"`
	Price    int64     `json:"price"`
	At       time.Time `json:"at"`
}

type Company struct {
	ID               string            `json:"id"`
	Wallet           TradingWallet     `json:"wallet"`
	Status           string            `json:"status"` // subscription, listed, failed
	Shares           int64             `json:"shares"`
	IPOPrice         int64             `json:"ipoPrice"`
	IPOMinShares     int64             `json:"ipoMinShares"`
	IPOEnds          time.Time         `json:"ipoEnds"`
	Subscriptions    map[string]int64  `json:"subscriptions"`
	IPOCash          int64             `json:"ipoCash"`
	Lines            int32             `json:"lines"`
	Plan             CompanyPlan       `json:"plan"`
	Batches          []CompanyBatch    `json:"batches"`
	NextBatchSeq     int64             `json:"nextBatchSeq"`
	PackCharges      map[int32]int32   `json:"packCharges"`
	PackModes        map[int32]string  `json:"packModes"`
	PackCosts        map[int32]int64   `json:"packCosts"`
	StockCost        map[string]int64  `json:"stockCost"`
	Revenue          int64             `json:"revenue"`
	RealizedProfit   int64             `json:"realizedProfit"`
	Dividends        int64             `json:"dividends"`
	CompletedBatches int64             `json:"completedBatches"`
	StatusReason     string            `json:"statusReason"`
	Vote             *CompanyVote      `json:"vote,omitempty"`
	NextVoteAt       time.Time         `json:"nextVoteAt"`
	Expansion        *CompanyExpansion `json:"expansion,omitempty"`
}

type CompanyExpansion struct {
	Pack   string `json:"pack"`
	Budget int64  `json:"budget"`
}

type CompanyPlan struct {
	Route         string `json:"route"`
	ActiveLines   int32  `json:"activeLines"`
	AskPrice      int64  `json:"askPrice"`
	InputBudget   int64  `json:"inputBudget"` // maximum landed input cost per batch
	Pack          string `json:"pack"`
	ExpandWith    string `json:"expandWith"`
	Dividend      int64  `json:"dividend"`
	CapitalBudget int64  `json:"capitalBudget"`
}

type CompanyBatch struct {
	ID     int64     `json:"id"`
	Line   int32     `json:"line"`
	Ends   time.Time `json:"ends"`
	Output int64     `json:"output"`
	Cost   int64     `json:"cost"`
}

type CompanyVote struct {
	ID      int64            `json:"id"`
	Ends    time.Time        `json:"ends"`
	Weights map[string]int64 `json:"weights"`
	Ballots map[string]bool  `json:"ballots"`
	Plan    CompanyPlan      `json:"plan"`
	Result  string           `json:"result"`
}

type CompanyRecipe struct {
	Route   string
	Inputs  map[string]int64
	Seconds int64
}
type CompanySpec struct {
	ID, Name, Asset, Output string
	OutputUnits             int64
	ReferencePrice          int64
	Recipes                 []CompanyRecipe
}

const (
	ResConductiveAlloy       = "conductive_alloy"
	ResStableCrystal         = "stable_crystal"
	ResHeavyUnit             = "heavy_unit"
	ResPrecisionUnit         = "precision_unit"
	ResHeavyPack             = "heavy_workpack"
	ResPrecisionPack         = "precision_workpack"
	EconomyTickSeconds int64 = 60
	MaxCompanyLines    int32 = 4
)

func newTradingWallet(handle string) TradingWallet {
	return TradingWallet{Handle: handle, Stock: map[string]int64{}, Frozen: map[string]int64{}}
}
func EnsureEconomy(w *WorldState, now time.Time) {
	if w.Economy == nil {
		w.Economy = &EconomyState{Version: 1, Public: newTradingWallet("@public"), Companies: map[string]*Company{}, Policies: []MonetaryPolicy{}, LastTick: now.UTC().Truncate(time.Minute)}
	}
}
func FindCompanySpec(id string) (CompanySpec, bool) {
	for _, s := range CompanyCatalog {
		if s.ID == id {
			return s, true
		}
	}
	return CompanySpec{}, false
}
func ShareKey(id string) string { return "share:" + id }

// Amounts in recipe tables are whole units; every runtime stock is milli-units.
func units(entries ...any) map[string]int64 {
	m := map[string]int64{}
	for i := 0; i < len(entries); i += 2 {
		m[entries[i].(string)] = int64(entries[i+1].(int)) * ResourceScale
	}
	return m
}
