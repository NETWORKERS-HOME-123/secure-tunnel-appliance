package tuning

import (
	"log"
	"net"
	"sync"
	"time"
)

// ConnectionConfig holds tuned connection parameters
type ConnectionConfig struct {
	// TCP socket options
	TCPNoDelay           bool
	TCPKeepAliveInterval time.Duration
	TCPKeepAliveCount    int
	SocketRecvBuffer     int
	SocketSendBuffer     int

	// Timeouts
	DialTimeout      time.Duration
	ReadTimeout      time.Duration
	WriteTimeout     time.Duration
	IdleTimeout      time.Duration
	HandshakeTimeout time.Duration

	// Flow control
	MaxIdleConnections  int
	MaxOpenConnections  int
	ConnMaxLifetime     time.Duration
	ConnMaxIdleTime     time.Duration
	MaxConcurrentReads  int
	MaxConcurrentWrites int
}

// DefaultConnectionConfig returns optimized default settings
func DefaultConnectionConfig() *ConnectionConfig {
	return &ConnectionConfig{
		// TCP socket options - optimize for tunneling
		TCPNoDelay:           true, // Disable Nagle's algorithm for low latency
		TCPKeepAliveInterval: 30 * time.Second,
		TCPKeepAliveCount:    3,
		SocketRecvBuffer:     256 * 1024, // 256KB
		SocketSendBuffer:     256 * 1024, // 256KB

		// Timeouts
		DialTimeout:      10 * time.Second,
		ReadTimeout:      30 * time.Second,
		WriteTimeout:     30 * time.Second,
		IdleTimeout:      120 * time.Second,
		HandshakeTimeout: 15 * time.Second,

		// Flow control
		MaxIdleConnections:  25,
		MaxOpenConnections:  50,
		ConnMaxLifetime:     30 * time.Minute,
		ConnMaxIdleTime:     5 * time.Minute,
		MaxConcurrentReads:  100,
		MaxConcurrentWrites: 100,
	}
}

// ConnectionTuner applies tuning to network connections
type ConnectionTuner struct {
	config *ConnectionConfig
	mu     sync.RWMutex
}

// NewConnectionTuner creates a new connection tuner
func NewConnectionTuner(config *ConnectionConfig) *ConnectionTuner {
	if config == nil {
		config = DefaultConnectionConfig()
	}
	return &ConnectionTuner{
		config: config,
	}
}

// TuneConnection applies all tuning parameters to a network connection
func (ct *ConnectionTuner) TuneConnection(conn net.Conn) error {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	tcpConn, ok := conn.(*net.TCPConn)
	if !ok {
		// Non-TCP connection, skip tuning
		return nil
	}

	// Apply TCP_NODELAY
	if err := tcpConn.SetNoDelay(ct.config.TCPNoDelay); err != nil {
		log.Printf("[tuning] Error setting TCP_NODELAY: %v", err)
		return err
	}

	// Apply keep-alive
	if err := tcpConn.SetKeepAlive(true); err != nil {
		log.Printf("[tuning] Error setting keep-alive: %v", err)
		return err
	}

	// Apply socket buffer sizes
	if ct.config.SocketRecvBuffer > 0 {
		if err := tcpConn.SetReadBuffer(ct.config.SocketRecvBuffer); err != nil {
			log.Printf("[tuning] Error setting recv buffer: %v", err)
		}
	}

	if ct.config.SocketSendBuffer > 0 {
		if err := tcpConn.SetWriteBuffer(ct.config.SocketSendBuffer); err != nil {
			log.Printf("[tuning] Error setting send buffer: %v", err)
		}
	}

	return nil
}

// GetConfig returns current configuration
func (ct *ConnectionTuner) GetConfig() *ConnectionConfig {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	// Return a copy to prevent external modifications
	config := *ct.config
	return &config
}

// UpdateConfig updates configuration parameters
func (ct *ConnectionTuner) UpdateConfig(config *ConnectionConfig) {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	ct.config = config
}

// HighThroughputConfig returns settings optimized for high throughput
func HighThroughputConfig() *ConnectionConfig {
	config := DefaultConnectionConfig()
	config.SocketRecvBuffer = 512 * 1024 // 512KB
	config.SocketSendBuffer = 512 * 1024 // 512KB
	config.MaxOpenConnections = 100
	config.MaxIdleConnections = 50
	config.MaxConcurrentReads = 200
	config.MaxConcurrentWrites = 200
	return config
}

// LowLatencyConfig returns settings optimized for low latency
func LowLatencyConfig() *ConnectionConfig {
	config := DefaultConnectionConfig()
	config.TCPNoDelay = true
	config.ReadTimeout = 10 * time.Second
	config.WriteTimeout = 10 * time.Second
	config.IdleTimeout = 60 * time.Second
	config.SocketRecvBuffer = 64 * 1024 // 64KB
	config.SocketSendBuffer = 64 * 1024 // 64KB
	return config
}

// ConservativeConfig returns settings for low-resource environments
func ConservativeConfig() *ConnectionConfig {
	config := DefaultConnectionConfig()
	config.MaxOpenConnections = 25
	config.MaxIdleConnections = 10
	config.MaxConcurrentReads = 50
	config.MaxConcurrentWrites = 50
	config.SocketRecvBuffer = 32 * 1024 // 32KB
	config.SocketSendBuffer = 32 * 1024 // 32KB
	return config
}

// ConnectionPoolMonitor monitors connection pool health
type ConnectionPoolMonitor struct {
	mu                 sync.RWMutex
	openConnections    int
	idleConnections    int
	maxOpenConnections int
	waitCount          int
	waitDuration       time.Duration
	connectionErrors   int
	lastCheck          time.Time
}

// NewConnectionPoolMonitor creates a new pool monitor
func NewConnectionPoolMonitor(maxOpen int) *ConnectionPoolMonitor {
	return &ConnectionPoolMonitor{
		maxOpenConnections: maxOpen,
		lastCheck:          time.Now(),
	}
}

// RecordConnection records a new connection
func (cpm *ConnectionPoolMonitor) RecordConnection() {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	cpm.openConnections++
}

// RecordConnectionClose records a closed connection
func (cpm *ConnectionPoolMonitor) RecordConnectionClose() {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	if cpm.openConnections > 0 {
		cpm.openConnections--
	}
}

// RecordConnectionError records a connection error
func (cpm *ConnectionPoolMonitor) RecordConnectionError() {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	cpm.connectionErrors++
}

// RecordWait records a connection pool wait
func (cpm *ConnectionPoolMonitor) RecordWait(duration time.Duration) {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	cpm.waitCount++
	cpm.waitDuration += duration
}

// GetStats returns connection pool statistics
func (cpm *ConnectionPoolMonitor) GetStats() map[string]interface{} {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()

	utilizationPercent := 0.0
	if cpm.maxOpenConnections > 0 {
		utilizationPercent = float64(cpm.openConnections) / float64(cpm.maxOpenConnections) * 100
	}

	avgWaitTime := time.Duration(0)
	if cpm.waitCount > 0 {
		avgWaitTime = cpm.waitDuration / time.Duration(cpm.waitCount)
	}

	return map[string]interface{}{
		"open_connections":     cpm.openConnections,
		"idle_connections":     cpm.idleConnections,
		"max_open_connections": cpm.maxOpenConnections,
		"utilization_percent":  utilizationPercent,
		"wait_count":           cpm.waitCount,
		"avg_wait_time_ms":     avgWaitTime.Milliseconds(),
		"connection_errors":    cpm.connectionErrors,
		"last_check":           cpm.lastCheck,
	}
}

// Reset resets all statistics
func (cpm *ConnectionPoolMonitor) Reset() {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	cpm.waitCount = 0
	cpm.waitDuration = 0
	cpm.connectionErrors = 0
	cpm.lastCheck = time.Now()
}
