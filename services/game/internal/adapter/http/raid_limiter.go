package httpadapter

import (
	"crypto/sha256"
	"sync"
	"time"
)

// Bounded admission control runs before JSON decoding or database access. Domain
// movement cooldowns remain authoritative; this only limits command flooding.
type raidLimiter struct {
	mu        sync.Mutex
	debt      map[[32]byte]time.Time
	global    time.Time
	lastSweep time.Time
}

func (l *raidLimiter) allow(token string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.debt == nil {
		l.debt = make(map[[32]byte]time.Time)
	}
	if now.Sub(l.lastSweep) >= time.Second {
		for key, last := range l.debt {
			if last.Before(now.Add(-time.Minute)) {
				delete(l.debt, key)
			}
		}
		l.lastSweep = now
	}
	key := sha256.Sum256([]byte(token))
	last, exists := l.debt[key]
	if !exists && len(l.debt) >= 4096 {
		return false
	}
	if last.Before(now.Add(-time.Second)) {
		last = now.Add(-time.Second)
	}
	global := l.global
	if global.Before(now.Add(-time.Second)) {
		global = now.Add(-time.Second)
	}
	next := last.Add(50 * time.Millisecond)        // 20 commands/s, up to 1s burst credit
	nextGlobal := global.Add(2 * time.Millisecond) // 500 commands/s per process
	if next.After(now) || nextGlobal.After(now) {
		return false
	}
	l.debt[key], l.global = next, nextGlobal
	return true
}
