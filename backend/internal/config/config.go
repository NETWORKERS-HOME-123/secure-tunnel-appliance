package config

import (
	"os"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	Domain       string
	TunnelDomain string
	TCPPortMin   int
	TCPPortMax   int
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://ultraslim:ultraslim@localhost:5432/ultraslim?sslmode=disable"),
		JWTSecret:    getEnv("JWT_SECRET", "change-me-in-production-ultraslim-2026"),
		Domain:       getEnv("DOMAIN", "tunnel.networkershome.com"),
		TunnelDomain: getEnv("TUNNEL_DOMAIN", "tunnel.networkershome.com"),
		TCPPortMin:   10000,
		TCPPortMax:   20000,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
