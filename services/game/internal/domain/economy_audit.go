package domain

import (
	"encoding/json"
	"fmt"
	"time"
)

type EconomyRecord struct {
	ID      string          `json:"id"`
	Kind    string          `json:"kind"`
	Company string          `json:"company"`
	Actor   string          `json:"actor"`
	At      time.Time       `json:"at"`
	Data    json.RawMessage `json:"data"`
}

func RecordEconomy(w *WorldState, kind, company, actor string, data any, now time.Time) {
	raw, _ := json.Marshal(data)
	w.Economy.NextRecordSeq++
	w.PendingEconomyRecords = append(w.PendingEconomyRecords, EconomyRecord{ID: fmt.Sprintf("eco_%d", w.Economy.NextRecordSeq), Kind: kind, Company: company, Actor: actor, At: now.UTC(), Data: raw})
}
