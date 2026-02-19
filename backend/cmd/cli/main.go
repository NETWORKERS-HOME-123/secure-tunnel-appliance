package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/ultraslim/server/internal/models"
)

const version = "1.0.0"

type CLIConfig struct {
	ServerURL string `json:"server_url"`
	Token     string `json:"token"`
	APIKey    string `json:"api_key"`
	Email     string `json:"email"`
}

func configPath() string {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".ultraslim")
	os.MkdirAll(dir, 0700)
	return filepath.Join(dir, "config.json")
}

func loadConfig() *CLIConfig {
	cfg := &CLIConfig{ServerURL: "https://21tunnel.com"}
	data, err := os.ReadFile(configPath())
	if err != nil {
		return cfg
	}
	json.Unmarshal(data, cfg)
	return cfg
}

func saveConfig(cfg *CLIConfig) {
	data, _ := json.MarshalIndent(cfg, "", "  ")
	os.WriteFile(configPath(), data, 0600)
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "login":
		cmdLogin()
	case "connect":
		cmdConnect()
	case "status":
		cmdStatus()
	case "config":
		cmdConfig()
	case "version":
		fmt.Printf("ultraslim CLI v%s (%s/%s)\n", version, runtime.GOOS, runtime.GOARCH)
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`UltraSlim CLI - Secure Tunnel Client

Usage:
  ultraslim <command> [flags]

Commands:
  login              Authenticate with the server
  connect <port>     Create a tunnel to localhost:<port>
  status             Show active tunnels
  config             View/edit configuration
  version            Print version info
  help               Show this help

Examples:
  ultraslim login --email user@example.com --password mypassword
  ultraslim login --server https://21tunnel.com
  ultraslim connect 3000
  ultraslim connect 8080 --type tcp
  ultraslim connect 22 --type ssh
  ultraslim status`)
}

func cmdLogin() {
	fs := flag.NewFlagSet("login", flag.ExitOnError)
	email := fs.String("email", "", "Account email")
	password := fs.String("password", "", "Account password")
	server := fs.String("server", "", "Server URL (e.g., https://21tunnel.com)")
	apiKey := fs.String("api-key", "", "Use API key instead of email/password")
	fs.Parse(os.Args[2:])

	cfg := loadConfig()

	if *server != "" {
		cfg.ServerURL = strings.TrimRight(*server, "/")
	}

	if *apiKey != "" {
		cfg.APIKey = *apiKey
		cfg.Token = ""
		saveConfig(cfg)
		fmt.Println("API key saved. Use 'ultraslim connect <port>' to create a tunnel.")
		return
	}

	if *email == "" {
		fmt.Print("Email: ")
		fmt.Scanln(email)
	}
	if *password == "" {
		fmt.Print("Password: ")
		fmt.Scanln(password)
	}

	body, _ := json.Marshal(models.LoginRequest{Email: *email, Password: *password})
	resp, err := http.Post(cfg.ServerURL+"/api/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Fatalf("Failed to connect to server: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Fatalf("Login failed: %s", string(respBody))
	}

	var authResp models.AuthResponse
	json.NewDecoder(resp.Body).Decode(&authResp)

	cfg.Token = authResp.Token
	cfg.Email = authResp.User.Email
	cfg.APIKey = ""
	saveConfig(cfg)

	fmt.Printf("Logged in as %s (%s)\n", authResp.User.DisplayName, authResp.User.Email)
}

func cmdConnect() {
	fs := flag.NewFlagSet("connect", flag.ExitOnError)
	tunnelType := fs.String("type", "http", "Tunnel type: http, tcp, ssh, rdp, udp, ws")
	fs.Parse(os.Args[2:])

	if fs.NArg() < 1 {
		log.Fatal("Usage: ultraslim connect <port> [--type http|tcp|ssh]")
	}

	port := fs.Arg(0)
	var localPort int
	fmt.Sscanf(port, "%d", &localPort)
	if localPort <= 0 || localPort > 65535 {
		log.Fatalf("Invalid port: %s", port)
	}

	cfg := loadConfig()
	if cfg.Token == "" && cfg.APIKey == "" {
		log.Fatal("Not authenticated. Run 'ultraslim login' first.")
	}

	fmt.Printf("Connecting to %s...\n", cfg.ServerURL)

	// Build WebSocket URL
	wsURL := strings.Replace(cfg.ServerURL, "https://", "wss://", 1)
	wsURL = strings.Replace(wsURL, "http://", "ws://", 1)
	wsURL += "/ws/agent"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		log.Fatalf("Failed to connect to relay: %v", err)
	}

	// Send registration
	regPayload := models.RegisterTunnelPayload{
		Token:     cfg.Token,
		APIKey:    cfg.APIKey,
		LocalPort: localPort,
		Type:      *tunnelType,
	}

	conn.WriteJSON(models.ControlMessage{
		Type:    "register",
		Payload: regPayload,
	})

	// Read registration response
	_, msg, err := conn.ReadMessage()
	if err != nil {
		log.Fatalf("Failed to register tunnel: %v", err)
	}

	var ctrlMsg models.ControlMessage
	json.Unmarshal(msg, &ctrlMsg)

	if ctrlMsg.Type == "error" {
		log.Fatalf("Registration failed: %v", ctrlMsg.Payload)
	}

	if ctrlMsg.Type != "registered" {
		log.Fatalf("Unexpected response: %s", ctrlMsg.Type)
	}

	payloadBytes, _ := json.Marshal(ctrlMsg.Payload)
	var registered models.TunnelRegisteredPayload
	json.Unmarshal(payloadBytes, &registered)

	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════╗")
	fmt.Println("║                  UltraSlim Tunnel Active                ║")
	fmt.Println("╠══════════════════════════════════════════════════════════╣")
	fmt.Printf("║  Tunnel ID:  %-43s ║\n", registered.TunnelID)
	fmt.Printf("║  Forwarding: %-43s ║\n", fmt.Sprintf("%s -> localhost:%d", registered.PublicEndpoint, localPort))
	fmt.Printf("║  Type:       %-43s ║\n", *tunnelType)
	fmt.Println("╠══════════════════════════════════════════════════════════╣")
	fmt.Println("║  Press Ctrl+C to disconnect                             ║")
	fmt.Println("╚══════════════════════════════════════════════════════════╝")
	fmt.Println()

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Handle proxy requests from relay
	go handleProxyRequests(conn, localPort)

	// Handle pings
	conn.SetPongHandler(func(string) error { return nil })

	// Wait for shutdown signal
	<-sigCh
	fmt.Println("\nDisconnecting tunnel...")
	conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	conn.Close()
	fmt.Println("Tunnel closed.")
}

func handleProxyRequests(conn *websocket.Conn, localPort int) {
	localClient := &http.Client{
		Timeout: 30 * time.Second,
	}

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				log.Printf("Connection lost: %v", err)
				// Reconnection logic
				fmt.Println("Connection lost. Attempting to reconnect...")
				time.Sleep(5 * time.Second)
			}
			return
		}

		var ctrlMsg models.ControlMessage
		if err := json.Unmarshal(msg, &ctrlMsg); err != nil {
			continue
		}

		switch ctrlMsg.Type {
		case "proxy_request":
			go func() {
				payloadBytes, _ := json.Marshal(ctrlMsg.Payload)
				var req models.ProxyRequestPayload
				if err := json.Unmarshal(payloadBytes, &req); err != nil {
					return
				}

				// Forward to local service
				localURL := fmt.Sprintf("http://localhost:%d%s", localPort, req.Path)

				var bodyReader io.Reader
				if req.Body != "" {
					decoded, err := base64.StdEncoding.DecodeString(req.Body)
					if err != nil {
						bodyReader = strings.NewReader(req.Body)
					} else {
						bodyReader = bytes.NewReader(decoded)
					}
				}

				httpReq, err := http.NewRequest(req.Method, localURL, bodyReader)
				if err != nil {
					sendErrorResponse(conn, req.RequestID, 502, "failed to create request")
					return
				}

				for k, v := range req.Headers {
					if !isHopByHopHeader(k) {
						httpReq.Header.Set(k, v)
					}
				}

				start := time.Now()
				resp, err := localClient.Do(httpReq)
				elapsed := time.Since(start)

				if err != nil {
					sendErrorResponse(conn, req.RequestID, 502, fmt.Sprintf("local service error: %v", err))
					fmt.Printf("  %-6s %-30s %3d %8s [ERROR]\n", req.Method, truncate(req.Path, 30), 502, elapsed.Round(time.Millisecond))
					return
				}
				defer resp.Body.Close()

				respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))

				headers := make(map[string]string)
				for k, v := range resp.Header {
					if len(v) > 0 && !isHopByHopHeader(k) {
						headers[k] = v[0]
					}
				}

				proxyResp := models.ProxyResponsePayload{
					RequestID:  req.RequestID,
					StatusCode: resp.StatusCode,
					Headers:    headers,
					Body:       base64.StdEncoding.EncodeToString(respBody),
				}

				conn.WriteJSON(models.ControlMessage{
					Type:    "proxy_response",
					Payload: proxyResp,
				})

				// Print traffic log
				statusColor := "\033[32m" // green
				if resp.StatusCode >= 400 {
					statusColor = "\033[31m" // red
				} else if resp.StatusCode >= 300 {
					statusColor = "\033[33m" // yellow
				}
				fmt.Printf("  %-6s %-30s %s%3d\033[0m %8s %6s\n",
					req.Method, truncate(req.Path, 30),
					statusColor, resp.StatusCode,
					elapsed.Round(time.Millisecond),
					formatBytes(int64(len(respBody))))
			}()

		case "heartbeat_ack":
			// OK

		case "tcp_connect":
			// TCP tunnel handling would go here
			log.Println("TCP connect request received (not yet fully implemented)")
		}
	}
}

func sendErrorResponse(conn *websocket.Conn, requestID string, statusCode int, errMsg string) {
	conn.WriteJSON(models.ControlMessage{
		Type: "proxy_response",
		Payload: models.ProxyResponsePayload{
			RequestID:  requestID,
			StatusCode: statusCode,
			Headers:    map[string]string{"Content-Type": "text/plain"},
			Body:       base64.StdEncoding.EncodeToString([]byte(errMsg)),
		},
	})
}

func cmdStatus() {
	cfg := loadConfig()
	if cfg.Token == "" && cfg.APIKey == "" {
		log.Fatal("Not authenticated. Run 'ultraslim login' first.")
	}

	req, _ := http.NewRequest("GET", cfg.ServerURL+"/api/tunnels", nil)
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("Failed to fetch status: %v", err)
	}
	defer resp.Body.Close()

	var tunnels []models.Tunnel
	json.NewDecoder(resp.Body).Decode(&tunnels)

	if len(tunnels) == 0 {
		fmt.Println("No tunnels found.")
		return
	}

	fmt.Printf("%-12s %-8s %-8s %-40s %-8s\n", "TUNNEL ID", "TYPE", "STATUS", "ENDPOINT", "PORT")
	fmt.Println(strings.Repeat("-", 80))
	for _, t := range tunnels {
		status := t.Status
		if status == "online" {
			status = "\033[32monline\033[0m"
		} else {
			status = "\033[31moffline\033[0m"
		}
		fmt.Printf("%-12s %-8s %-17s %-40s %-8d\n", t.TunnelID, t.Type, status, t.PublicEndpoint, t.LocalPort)
	}
}

func cmdConfig() {
	cfg := loadConfig()
	fmt.Printf("Server URL: %s\n", cfg.ServerURL)
	fmt.Printf("Email:      %s\n", cfg.Email)
	fmt.Printf("Token:      %s\n", maskString(cfg.Token))
	fmt.Printf("API Key:    %s\n", maskString(cfg.APIKey))
	fmt.Printf("Config:     %s\n", configPath())
}

// ── Helpers ──────────────────────────────────────────────

func isHopByHopHeader(h string) bool {
	switch strings.ToLower(h) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
		"te", "trailers", "transfer-encoding", "upgrade":
		return true
	}
	return false
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}

func maskString(s string) string {
	if s == "" {
		return "(not set)"
	}
	if len(s) < 10 {
		return "***"
	}
	return s[:6] + "..." + s[len(s)-4:]
}

func formatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%dB", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%cB", float64(b)/float64(div), "KMGTPE"[exp])
}

