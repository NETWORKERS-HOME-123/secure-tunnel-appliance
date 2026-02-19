package monitoring

import (
	"sync"
	"time"
)

// MetricType represents the type of metric
type MetricType string

const (
	CounterMetric   MetricType = "counter"
	GaugeMetric     MetricType = "gauge"
	HistogramMetric MetricType = "histogram"
)

// Metric represents a single metric measurement
type Metric struct {
	Name      string
	Type      MetricType
	Value     float64
	Timestamp time.Time
	Labels    map[string]string
}

// Metrics is a thread-safe metrics collector
type Metrics struct {
	mu      sync.RWMutex
	metrics map[string]*metricData
}

type metricData struct {
	typ     MetricType
	value   float64
	count   int64
	sum     float64
	min     float64
	max     float64
	updated time.Time
	labels  map[string]string
}

// NewMetrics creates a new metrics collector
func NewMetrics() *Metrics {
	return &Metrics{
		metrics: make(map[string]*metricData),
	}
}

// IncrementCounter increments a counter metric
func (m *Metrics) IncrementCounter(name string, labels map[string]string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := m.buildKey(name, labels)
	if data, exists := m.metrics[key]; exists {
		data.value++
		data.updated = time.Now()
	} else {
		m.metrics[key] = &metricData{
			typ:     CounterMetric,
			value:   1,
			count:   1,
			updated: time.Now(),
			labels:  labels,
		}
	}
}

// SetGauge sets a gauge metric value
func (m *Metrics) SetGauge(name string, value float64, labels map[string]string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := m.buildKey(name, labels)
	m.metrics[key] = &metricData{
		typ:     GaugeMetric,
		value:   value,
		updated: time.Now(),
		labels:  labels,
	}
}

// RecordHistogram records a histogram value
func (m *Metrics) RecordHistogram(name string, value float64, labels map[string]string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := m.buildKey(name, labels)
	if data, exists := m.metrics[key]; exists {
		data.count++
		data.sum += value
		if value < data.min {
			data.min = value
		}
		if value > data.max {
			data.max = value
		}
		data.updated = time.Now()
	} else {
		m.metrics[key] = &metricData{
			typ:     HistogramMetric,
			value:   value,
			count:   1,
			sum:     value,
			min:     value,
			max:     value,
			updated: time.Now(),
			labels:  labels,
		}
	}
}

// GetMetric retrieves a metric by name
func (m *Metrics) GetMetric(name string) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := m.buildKey(name, nil)
	if data, exists := m.metrics[key]; exists {
		return m.metricToMap(name, data)
	}
	return nil
}

// GetAllMetrics returns all recorded metrics
func (m *Metrics) GetAllMetrics() map[string]map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]map[string]interface{})
	for key, data := range m.metrics {
		name := m.extractName(key)
		if result[name] == nil {
			result[name] = make(map[string]interface{})
		}
		result[name][key] = m.metricToMap(name, data)
	}
	return result
}

// GetHistogramStats returns statistics for a histogram metric
func (m *Metrics) GetHistogramStats(name string) map[string]float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := m.buildKey(name, nil)
	if data, exists := m.metrics[key]; exists && data.typ == HistogramMetric {
		return map[string]float64{
			"count":   float64(data.count),
			"sum":     data.sum,
			"min":     data.min,
			"max":     data.max,
			"average": data.sum / float64(data.count),
		}
	}
	return nil
}

// metricToMap converts metric data to map representation
func (m *Metrics) metricToMap(name string, data *metricData) map[string]interface{} {
	result := map[string]interface{}{
		"name":      name,
		"type":      string(data.typ),
		"value":     data.value,
		"timestamp": data.updated,
		"labels":    data.labels,
	}

	if data.typ == HistogramMetric {
		result["count"] = data.count
		result["sum"] = data.sum
		result["min"] = data.min
		result["max"] = data.max
		result["average"] = data.sum / float64(data.count)
	}

	return result
}

// buildKey builds a metric key from name and labels
func (m *Metrics) buildKey(name string, labels map[string]string) string {
	if labels == nil || len(labels) == 0 {
		return name
	}
	key := name
	for k, v := range labels {
		key += ":" + k + "=" + v
	}
	return key
}

// extractName extracts metric name from key
func (m *Metrics) extractName(key string) string {
	if idx := len(key) - len(key); idx >= 0 {
		// Extract up to first colon (which separates name from labels)
		for i := 0; i < len(key); i++ {
			if key[i] == ':' {
				return key[:i]
			}
		}
	}
	return key
}

// Reset clears all metrics
func (m *Metrics) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metrics = make(map[string]*metricData)
}
