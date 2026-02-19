package ratelimit

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// DynamicRateLimiter adapts rate limits based on system load
type DynamicRateLimiter struct {
	mu sync.RWMutex

	// Current limits
	baseRate float64
	burst    int
	limiters *sync.Map // map[string]*rate.Limiter

	// Adaptation parameters
	minRate          float64
	maxRate          float64
	targetQueueDepth int
	currentLoad      float64
	lastAdjustment   time.Time
	adjustmentPeriod time.Duration

	// Metrics
	requestCount  int64
	rejectedCount int64
	queueDepth    int
}

// NewDynamicRateLimiter creates a new dynamic rate limiter
func NewDynamicRateLimiter(baseRate float64, burst int) *DynamicRateLimiter {
	return &DynamicRateLimiter{
		baseRate:         baseRate,
		burst:            burst,
		limiters:         &sync.Map{},
		minRate:          baseRate * 0.5, // Can go down to 50% of base
		maxRate:          baseRate * 2.0, // Can go up to 200% of base
		targetQueueDepth: 10,
		lastAdjustment:   time.Now(),
		adjustmentPeriod: 30 * time.Second,
	}
}

// Allow checks if a request is allowed for the given identifier
func (drl *DynamicRateLimiter) Allow(identifier string) bool {
	drl.mu.Lock()
	currentRate := drl.baseRate
	drl.mu.Unlock()

	// Get or create limiter for this identifier
	limiter, _ := drl.limiters.LoadOrStore(identifier, rate.NewLimiter(rate.Limit(currentRate), drl.burst))

	allowed := limiter.(*rate.Limiter).Allow()

	drl.mu.Lock()
	drl.requestCount++
	if !allowed {
		drl.rejectedCount++
	}
	drl.mu.Unlock()

	return allowed
}

// AllowN checks if n requests are allowed
func (drl *DynamicRateLimiter) AllowN(identifier string, n int) bool {
	drl.mu.Lock()
	currentRate := drl.baseRate
	drl.mu.Unlock()

	limiter, _ := drl.limiters.LoadOrStore(identifier, rate.NewLimiter(rate.Limit(currentRate), drl.burst))

	allowed := limiter.(*rate.Limiter).AllowN(time.Now(), n)

	drl.mu.Lock()
	drl.requestCount += int64(n)
	if !allowed {
		drl.rejectedCount++
	}
	drl.mu.Unlock()

	return allowed
}

// UpdateLoad updates the current system load (0.0 to 1.0)
func (drl *DynamicRateLimiter) UpdateLoad(load float64) {
	drl.mu.Lock()
	defer drl.mu.Unlock()

	drl.currentLoad = load

	// Check if it's time to adjust rates
	if time.Since(drl.lastAdjustment) < drl.adjustmentPeriod {
		return
	}

	drl.adjustRates()
	drl.lastAdjustment = time.Now()
}

// adjustRates adapts rate limits based on current load
func (drl *DynamicRateLimiter) adjustRates() {
	// Scale rate based on load (inverted - higher load = lower rate)
	scaleFactor := 1.0 - (drl.currentLoad * 0.5) // Max reduction of 50%
	newRate := drl.baseRate * scaleFactor

	// Clamp to min/max
	if newRate < drl.minRate {
		newRate = drl.minRate
	}
	if newRate > drl.maxRate {
		newRate = drl.maxRate
	}

	drl.baseRate = newRate
}

// GetStats returns current rate limiter statistics
func (drl *DynamicRateLimiter) GetStats() map[string]interface{} {
	drl.mu.RLock()
	defer drl.mu.RUnlock()

	rejectionRate := 0.0
	if drl.requestCount > 0 {
		rejectionRate = float64(drl.rejectedCount) / float64(drl.requestCount)
	}

	return map[string]interface{}{
		"current_rate":    drl.baseRate,
		"min_rate":        drl.minRate,
		"max_rate":        drl.maxRate,
		"burst":           drl.burst,
		"current_load":    drl.currentLoad,
		"total_requests":  drl.requestCount,
		"rejected_count":  drl.rejectedCount,
		"rejection_rate":  rejectionRate,
		"last_adjustment": drl.lastAdjustment,
	}
}

// AdaptiveCircuitBreakerRateLimiter combines rate limiting with circuit breaker
type AdaptiveCircuitBreakerRateLimiter struct {
	mu sync.RWMutex

	// Rate limiting
	limiter *DynamicRateLimiter

	// Circuit breaker state
	failureCount int
	successCount int
	circuitOpen  bool
	lastFailure  time.Time
	resetTimeout time.Duration

	// Thresholds
	failureThreshold int
	successThreshold int
}

// NewAdaptiveCircuitBreakerRateLimiter creates a new adaptive rate limiter with circuit breaker
func NewAdaptiveCircuitBreakerRateLimiter(baseRate float64, burst int) *AdaptiveCircuitBreakerRateLimiter {
	return &AdaptiveCircuitBreakerRateLimiter{
		limiter:          NewDynamicRateLimiter(baseRate, burst),
		failureThreshold: 5,
		successThreshold: 3,
		resetTimeout:     1 * time.Minute,
	}
}

// Allow checks if request is allowed with circuit breaker protection
func (acbrl *AdaptiveCircuitBreakerRateLimiter) Allow(identifier string) bool {
	acbrl.mu.RLock()
	if acbrl.circuitOpen && time.Since(acbrl.lastFailure) < acbrl.resetTimeout {
		acbrl.mu.RUnlock()
		return false
	}
	if acbrl.circuitOpen {
		acbrl.mu.Unlock()
		acbrl.mu.Lock()
		acbrl.circuitOpen = false
		acbrl.successCount = 0
		acbrl.mu.Unlock()
		acbrl.mu.RLock()
	}
	acbrl.mu.RUnlock()

	return acbrl.limiter.Allow(identifier)
}

// RecordSuccess records a successful request
func (acbrl *AdaptiveCircuitBreakerRateLimiter) RecordSuccess() {
	acbrl.mu.Lock()
	defer acbrl.mu.Unlock()

	acbrl.failureCount = 0
	acbrl.successCount++

	if acbrl.circuitOpen && acbrl.successCount >= acbrl.successThreshold {
		acbrl.circuitOpen = false
		acbrl.successCount = 0
	}
}

// RecordFailure records a failed request
func (acbrl *AdaptiveCircuitBreakerRateLimiter) RecordFailure() {
	acbrl.mu.Lock()
	defer acbrl.mu.Unlock()

	acbrl.failureCount++
	acbrl.lastFailure = time.Now()

	if acbrl.failureCount >= acbrl.failureThreshold {
		acbrl.circuitOpen = true
		acbrl.failureCount = 0
	}
}

// IsCircuitOpen returns if circuit is currently open
func (acbrl *AdaptiveCircuitBreakerRateLimiter) IsCircuitOpen() bool {
	acbrl.mu.RLock()
	defer acbrl.mu.RUnlock()
	return acbrl.circuitOpen
}

// GetStats returns combined rate limiter and circuit breaker stats
func (acbrl *AdaptiveCircuitBreakerRateLimiter) GetStats() map[string]interface{} {
	acbrl.mu.RLock()
	circuitOpen := acbrl.circuitOpen
	failureCount := acbrl.failureCount
	successCount := acbrl.successCount
	acbrl.mu.RUnlock()

	stats := acbrl.limiter.GetStats()
	stats["circuit_open"] = circuitOpen
	stats["failure_count"] = failureCount
	stats["success_count"] = successCount

	return stats
}

// BucketRateLimiter provides token bucket rate limiting with multiple buckets
type BucketRateLimiter struct {
	mu      sync.RWMutex
	buckets map[string]*tokenBucket
}

type tokenBucket struct {
	tokens     float64
	capacity   float64
	refillRate float64
	lastRefill time.Time
	mu         sync.Mutex
}

// NewBucketRateLimiter creates a new bucket-based rate limiter
func NewBucketRateLimiter() *BucketRateLimiter {
	return &BucketRateLimiter{
		buckets: make(map[string]*tokenBucket),
	}
}

// Allow checks if a request is allowed using token bucket algorithm
func (brl *BucketRateLimiter) Allow(key string, capacity float64, refillRate float64) bool {
	brl.mu.Lock()
	bucket, exists := brl.buckets[key]
	if !exists {
		bucket = &tokenBucket{
			tokens:     capacity,
			capacity:   capacity,
			refillRate: refillRate,
			lastRefill: time.Now(),
		}
		brl.buckets[key] = bucket
	}
	brl.mu.Unlock()

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(bucket.lastRefill).Seconds()
	bucket.tokens = bucket.tokens + (bucket.refillRate * elapsed)
	if bucket.tokens > bucket.capacity {
		bucket.tokens = bucket.capacity
	}
	bucket.lastRefill = now

	// Check if we have a token
	if bucket.tokens >= 1.0 {
		bucket.tokens--
		return true
	}

	return false
}

// Reset resets all buckets
func (brl *BucketRateLimiter) Reset() {
	brl.mu.Lock()
	defer brl.mu.Unlock()
	brl.buckets = make(map[string]*tokenBucket)
}
