package circuitbreaker

import (
	"errors"
	"sync"
	"time"
)

// State represents the circuit breaker state
type State int

const (
	Closed State = iota
	Open
	HalfOpen
)

// CircuitBreaker implements the circuit breaker pattern for fault tolerance
type CircuitBreaker struct {
	mu              sync.RWMutex
	state           State
	failureCount    int
	successCount    int
	lastFailureTime time.Time
	lastStateChange time.Time

	// Configuration
	maxFailures      int
	resetTimeout     time.Duration
	halfOpenRequests int
}

var (
	ErrCircuitOpen = errors.New("circuit breaker is open")
	ErrCircuitFail = errors.New("circuit breaker failure threshold exceeded")
)

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(maxFailures int, resetTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:            Closed,
		maxFailures:      maxFailures,
		resetTimeout:     resetTimeout,
		halfOpenRequests: 0,
	}
}

// Execute runs the given function with circuit breaker protection
func (cb *CircuitBreaker) Execute(fn func() error) error {
	cb.mu.Lock()

	// Check if we should attempt to close the circuit
	if cb.state == Open && time.Since(cb.lastFailureTime) > cb.resetTimeout {
		cb.state = HalfOpen
		cb.successCount = 0
		cb.failureCount = 0
		cb.lastStateChange = time.Now()
	}

	if cb.state == Open {
		cb.mu.Unlock()
		return ErrCircuitOpen
	}

	cb.mu.Unlock()

	// Execute the function
	err := fn()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		return cb.recordFailure()
	}

	return cb.recordSuccess()
}

// recordFailure handles failure recording and state transitions
func (cb *CircuitBreaker) recordFailure() error {
	cb.failureCount++
	cb.lastFailureTime = time.Now()

	if cb.state == HalfOpen {
		// Failure in half-open state immediately opens circuit
		cb.state = Open
		cb.lastStateChange = time.Now()
		return ErrCircuitFail
	}

	if cb.failureCount >= cb.maxFailures && cb.state == Closed {
		cb.state = Open
		cb.lastStateChange = time.Now()
		return ErrCircuitFail
	}

	return ErrCircuitFail
}

// recordSuccess handles success recording and state transitions
func (cb *CircuitBreaker) recordSuccess() error {
	cb.failureCount = 0

	if cb.state == HalfOpen {
		cb.successCount++
		// 3 successful requests in half-open state closes the circuit
		if cb.successCount >= 3 {
			cb.state = Closed
			cb.lastStateChange = time.Now()
			cb.successCount = 0
		}
	}

	return nil
}

// GetState returns current circuit breaker state
func (cb *CircuitBreaker) GetState() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Reset manually resets the circuit breaker
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = Closed
	cb.failureCount = 0
	cb.successCount = 0
	cb.lastStateChange = time.Now()
}

// GetStats returns current circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	stateStr := "closed"
	if cb.state == Open {
		stateStr = "open"
	} else if cb.state == HalfOpen {
		stateStr = "half-open"
	}

	return map[string]interface{}{
		"state":             stateStr,
		"failure_count":     cb.failureCount,
		"success_count":     cb.successCount,
		"last_failure_time": cb.lastFailureTime,
		"last_state_change": cb.lastStateChange,
		"time_until_retry":  cb.timeUntilRetry(),
	}
}

// timeUntilRetry calculates time until circuit can be retried
func (cb *CircuitBreaker) timeUntilRetry() time.Duration {
	if cb.state != Open {
		return 0
	}
	until := cb.resetTimeout - time.Since(cb.lastFailureTime)
	if until < 0 {
		return 0
	}
	return until
}
