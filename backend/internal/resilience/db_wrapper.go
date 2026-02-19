package resilience

import (
	"database/sql"
	"log"

	"github.com/ultraslim/server/internal/circuitbreaker"
	"github.com/ultraslim/server/internal/db"
)

// DatabaseWrapper wraps database operations with circuit breaker protection
type DatabaseWrapper struct {
	cb *circuitbreaker.CircuitBreaker
}

// NewDatabaseWrapper creates a new database wrapper
func NewDatabaseWrapper(cb *circuitbreaker.CircuitBreaker) *DatabaseWrapper {
	return &DatabaseWrapper{
		cb: cb,
	}
}

// QueryRow executes a query with circuit breaker protection
func (dw *DatabaseWrapper) QueryRow(query string, args ...interface{}) (*sql.Row, error) {
	var result *sql.Row
	err := dw.cb.Execute(func() error {
		result = db.DB.QueryRow(query, args...)
		return nil
	})

	if err != nil {
		log.Printf("[resilience] Circuit breaker open for QueryRow: %v", err)
		return nil, err
	}

	return result, nil
}

// Query executes a query returning rows with circuit breaker protection
func (dw *DatabaseWrapper) Query(query string, args ...interface{}) (*sql.Rows, error) {
	var rows *sql.Rows
	err := dw.cb.Execute(func() error {
		var queryErr error
		rows, queryErr = db.DB.Query(query, args...)
		return queryErr
	})

	if err != nil {
		log.Printf("[resilience] Circuit breaker open for Query: %v", err)
		return nil, err
	}

	return rows, nil
}

// Exec executes a command with circuit breaker protection
func (dw *DatabaseWrapper) Exec(query string, args ...interface{}) (sql.Result, error) {
	var result sql.Result
	err := dw.cb.Execute(func() error {
		var execErr error
		result, execErr = db.DB.Exec(query, args...)
		return execErr
	})

	if err != nil {
		log.Printf("[resilience] Circuit breaker open for Exec: %v", err)
		return nil, err
	}

	return result, nil
}

// BeginTx starts a transaction with circuit breaker protection
func (dw *DatabaseWrapper) BeginTx() (*sql.Tx, error) {
	var tx *sql.Tx
	err := dw.cb.Execute(func() error {
		var txErr error
		tx, txErr = db.DB.BeginTx(nil, nil)
		return txErr
	})

	if err != nil {
		log.Printf("[resilience] Circuit breaker open for BeginTx: %v", err)
		return nil, err
	}

	return tx, nil
}
