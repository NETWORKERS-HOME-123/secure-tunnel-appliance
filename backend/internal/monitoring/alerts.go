package monitoring

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// AlertLevel represents alert severity
type AlertLevel string

const (
	Critical AlertLevel = "critical"
	Warning  AlertLevel = "warning"
	Info     AlertLevel = "info"
)

// Alert represents a system alert
type Alert struct {
	ID        string
	Level     AlertLevel
	Title     string
	Message   string
	Timestamp time.Time
	Resolved  bool
}

// AlertRule defines conditions for triggering alerts
type AlertRule struct {
	Name      string
	Metric    string
	Condition string
	Threshold float64
	Duration  time.Duration
	Level     AlertLevel
}

// AlertManager manages system alerts
type AlertManager struct {
	mu       sync.RWMutex
	alerts   map[string]*Alert
	rules    []*AlertRule
	handlers []AlertHandler
	metrics  *Metrics
}

// AlertHandler is called when an alert is triggered
type AlertHandler func(alert *Alert)

// NewAlertManager creates a new alert manager
func NewAlertManager(metrics *Metrics) *AlertManager {
	return &AlertManager{
		alerts:   make(map[string]*Alert),
		rules:    make([]*AlertRule, 0),
		handlers: make([]AlertHandler, 0),
		metrics:  metrics,
	}
}

// AddRule adds an alert rule
func (am *AlertManager) AddRule(rule *AlertRule) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.rules = append(am.rules, rule)
}

// AddHandler adds an alert handler
func (am *AlertManager) AddHandler(handler AlertHandler) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.handlers = append(am.handlers, handler)
}

// TriggerAlert creates and triggers a new alert
func (am *AlertManager) TriggerAlert(level AlertLevel, title, message string) {
	am.mu.Lock()
	defer am.mu.Unlock()

	alert := &Alert{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Level:     level,
		Title:     title,
		Message:   message,
		Timestamp: time.Now(),
		Resolved:  false,
	}

	am.alerts[alert.ID] = alert

	// Log the alert
	logLevel := "[" + string(level) + "]"
	log.Printf("%s %s: %s", logLevel, title, message)

	// Call handlers
	for _, handler := range am.handlers {
		go handler(alert)
	}
}

// ResolveAlert marks an alert as resolved
func (am *AlertManager) ResolveAlert(alertID string) {
	am.mu.Lock()
	defer am.mu.Unlock()

	if alert, exists := am.alerts[alertID]; exists {
		alert.Resolved = true
		log.Printf("[RESOLVED] %s", alert.Title)
	}
}

// GetAlerts returns all active alerts
func (am *AlertManager) GetAlerts() []*Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	alerts := make([]*Alert, 0)
	for _, alert := range am.alerts {
		if !alert.Resolved {
			alerts = append(alerts, alert)
		}
	}
	return alerts
}

// GetAlertByID retrieves an alert by ID
func (am *AlertManager) GetAlertByID(alertID string) *Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()
	return am.alerts[alertID]
}

// EvaluateRules evaluates all alert rules against current metrics
func (am *AlertManager) EvaluateRules() {
	am.mu.RLock()
	rules := make([]*AlertRule, len(am.rules))
	copy(rules, am.rules)
	am.mu.RUnlock()

	for _, rule := range rules {
		metric := am.metrics.GetMetric(rule.Metric)
		if metric == nil {
			continue
		}

		value, ok := metric["value"].(float64)
		if !ok {
			continue
		}

		triggered := false
		switch rule.Condition {
		case "greater_than":
			triggered = value > rule.Threshold
		case "less_than":
			triggered = value < rule.Threshold
		case "equals":
			triggered = value == rule.Threshold
		}

		if triggered {
			am.TriggerAlert(
				rule.Level,
				rule.Name,
				fmt.Sprintf("Metric %s (%.2f) triggered alert rule", rule.Metric, value),
			)
		}
	}
}

// DefaultLogHandler logs alerts to stdout
func DefaultLogHandler(alert *Alert) {
	log.Printf("[ALERT] [%s] %s: %s (ID: %s)", alert.Level, alert.Title, alert.Message, alert.ID)
}

// DatabaseErrorHandler triggers database-specific alerts
type DatabaseErrorHandler struct {
	failureCount int
	threshold    int
	window       time.Duration
	lastCheck    time.Time
}

// NewDatabaseErrorHandler creates a database error handler
func NewDatabaseErrorHandler(threshold int, window time.Duration) *DatabaseErrorHandler {
	return &DatabaseErrorHandler{
		threshold: threshold,
		window:    window,
		lastCheck: time.Now(),
	}
}

// ConnectionPoolHealthAlert checks database connection pool health
func (am *AlertManager) CheckConnectionPoolHealth(openConns, maxConns int) {
	utilizationPercent := float64(openConns) / float64(maxConns) * 100

	if utilizationPercent > 90 {
		am.TriggerAlert(
			Critical,
			"High DB Connection Pool Utilization",
			fmt.Sprintf("Connection pool at %.1f%% utilization (%d/%d)", utilizationPercent, openConns, maxConns),
		)
	} else if utilizationPercent > 75 {
		am.TriggerAlert(
			Warning,
			"Elevated DB Connection Pool Usage",
			fmt.Sprintf("Connection pool at %.1f%% utilization (%d/%d)", utilizationPercent, openConns, maxConns),
		)
	}
}

// HighErrorRateAlert checks for high error rates
func (am *AlertManager) CheckErrorRate(totalRequests, errorCount int) {
	if totalRequests == 0 {
		return
	}

	errorRate := float64(errorCount) / float64(totalRequests)
	if errorRate > 0.1 {
		am.TriggerAlert(
			Critical,
			"High API Error Rate",
			fmt.Sprintf("Error rate is %.1f%% (%d/%d requests)", errorRate*100, errorCount, totalRequests),
		)
	} else if errorRate > 0.05 {
		am.TriggerAlert(
			Warning,
			"Elevated API Error Rate",
			fmt.Sprintf("Error rate is %.1f%% (%d/%d requests)", errorRate*100, errorCount, totalRequests),
		)
	}
}

// SlowQueryAlert checks for slow database queries
func (am *AlertManager) CheckSlowQueries(avgQueryTime, threshold time.Duration) {
	if avgQueryTime > threshold {
		am.TriggerAlert(
			Warning,
			"Slow Database Queries Detected",
			fmt.Sprintf("Average query time %.2fms exceeds threshold %.2fms", avgQueryTime.Seconds()*1000, threshold.Seconds()*1000),
		)
	}
}
