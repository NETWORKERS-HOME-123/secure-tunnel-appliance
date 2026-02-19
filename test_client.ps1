# UltraSlim API Test Client - Windows PowerShell
# Tests against live production API at https://21tunnel.com
# Usage: powershell -ExecutionPolicy Bypass -File test_client.ps1

param(
    [string]$BaseUrl = "https://21tunnel.com",
    [string]$AdminEmail = "admin@ultraslim.dev",
    [string]$AdminPassword = "TestPass123!",
    [switch]$OutputJson = $false
)

# Configuration
$script:BaseUrl = $BaseUrl
$script:Token = $null
$script:UserId = $null
$script:TunnelId = $null
$script:ApiKeyId = $null
$script:TestResults = @()
$script:TestsPassed = 0
$script:TestsFailed = 0

# Color codes for output
$Green = [ConsoleColor]::Green
$Red = [ConsoleColor]::Red
$Yellow = [ConsoleColor]::Yellow
$Cyan = [ConsoleColor]::Cyan
$White = [ConsoleColor]::White

function Write-Header {
    param([string]$Text)
    Write-Host "`n" -ForegroundColor $White
    Write-Host "=" * 70 -ForegroundColor $Cyan
    Write-Host "  $Text" -ForegroundColor $Cyan
    Write-Host "=" * 70 -ForegroundColor $Cyan
    Write-Host "`n" -ForegroundColor $White
}

function Write-TestResult {
    param(
        [string]$TestName,
        [string]$Status,
        [string]$Details = ""
    )

    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $result = @{
        timestamp = $timestamp
        name      = $TestName
        status    = $Status
        details   = $Details
    }

    $script:TestResults += $result

    if ($Status -eq "PASS") {
        $script:TestsPassed++
        $icon = "✅"
        $color = $Green
    } else {
        $script:TestsFailed++
        $icon = "❌"
        $color = $Red
    }

    Write-Host "$icon [$timestamp] $TestName`: $Status" -ForegroundColor $color
    if ($Details) {
        Write-Host "   Details: $Details" -ForegroundColor $White
    }
}

function Invoke-ApiRequest {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{}
    )

    try {
        $url = "$script:BaseUrl$Endpoint"

        # Add authorization header if token exists
        if ($script:Token) {
            $Headers["Authorization"] = "Bearer $script:Token"
        }

        # Set content type
        $Headers["Content-Type"] = "application/json"

        # Prepare request parameters
        $requestParams = @{
            Uri     = $url
            Method  = $Method
            Headers = $Headers
        }

        # Add body if present
        if ($Body) {
            $requestParams["Body"] = $Body | ConvertTo-Json
        }

        # Disable certificate validation for self-signed certs (dev only)
        if ($PSVersionTable.PSVersion.Major -lt 6) {
            # PowerShell 5.1 and below
            [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
        }

        $response = Invoke-WebRequest @requestParams -ErrorAction Stop
        return @{
            StatusCode = $response.StatusCode
            Content    = $response.Content | ConvertFrom-Json
            Success    = $true
        }
    }
    catch {
        $errorResponse = $_.Exception.Response
        $statusCode = if ($errorResponse) { $errorResponse.StatusCode.value__ } else { 0 }
        $errorContent = if ($errorResponse) {
            try { $errorResponse.Content | ConvertFrom-Json }
            catch { $_.Exception.Message }
        } else {
            $_.Exception.Message
        }

        return @{
            StatusCode = $statusCode
            Content    = $errorContent
            Success    = $false
            Error      = $_.Exception.Message
        }
    }
}

# Test 1: Health Check
function Test-HealthCheck {
    Write-Host "Testing: Health Check Endpoint..." -ForegroundColor $White

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/health"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $details = "Status: $($response.Content.status), Uptime: $($response.Content.uptime)"
        Write-TestResult "Health Check" "PASS" $details
        return $true
    } else {
        Write-TestResult "Health Check" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 2: Admin Login
function Test-AdminLogin {
    Write-Host "Testing: Admin Login..." -ForegroundColor $White

    $body = @{
        email    = $AdminEmail
        password = $AdminPassword
    }

    $response = Invoke-ApiRequest -Method "POST" -Endpoint "/api/auth/login" -Body $body

    if ($response.Success -and $response.StatusCode -eq 200) {
        $script:Token = $response.Content.token
        $script:UserId = $response.Content.user.id
        $details = "User: $($response.Content.user.email), Role: $($response.Content.user.role)"
        Write-TestResult "Admin Login" "PASS" $details
        return $true
    } else {
        Write-TestResult "Admin Login" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 3: User Signup
function Test-UserSignup {
    Write-Host "Testing: User Signup..." -ForegroundColor $White

    $timestamp = (Get-Date).Ticks
    $newEmail = "testuser_$timestamp@example.com"

    $body = @{
        email           = $newEmail
        password        = "TestPass123!"
        display_name    = "Test User"
    }

    $response = Invoke-ApiRequest -Method "POST" -Endpoint "/api/auth/signup" -Body $body

    if ($response.Success -and $response.StatusCode -eq 201) {
        $details = "Email: $newEmail, ID: $($response.Content.user.id)"
        Write-TestResult "User Signup" "PASS" $details
        return $true
    } else {
        Write-TestResult "User Signup" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 4: Get Profile
function Test-GetProfile {
    Write-Host "Testing: Get Profile..." -ForegroundColor $White

    if (-not $script:Token) {
        Write-TestResult "Get Profile" "SKIP" "No token available"
        return $false
    }

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/profile"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $details = "Email: $($response.Content.email), Display Name: $($response.Content.display_name)"
        Write-TestResult "Get Profile" "PASS" $details
        return $true
    } else {
        Write-TestResult "Get Profile" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 5: Create Tunnel
function Test-CreateTunnel {
    Write-Host "Testing: Create Tunnel..." -ForegroundColor $White

    if (-not $script:Token) {
        Write-TestResult "Create Tunnel" "SKIP" "No token available"
        return $false
    }

    $body = @{
        name              = "Test Tunnel $(Get-Random)"
        local_host        = "localhost"
        local_port        = 3000
        tunnel_type       = "http"
        max_connections   = 10
    }

    $response = Invoke-ApiRequest -Method "POST" -Endpoint "/api/tunnels" -Body $body

    if ($response.Success -and $response.StatusCode -eq 201) {
        $script:TunnelId = $response.Content.id
        $details = "Tunnel: $($response.Content.name), URL: $($response.Content.public_url)"
        Write-TestResult "Create Tunnel" "PASS" $details
        return $true
    } else {
        Write-TestResult "Create Tunnel" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 6: List Tunnels
function Test-ListTunnels {
    Write-Host "Testing: List Tunnels..." -ForegroundColor $White

    if (-not $script:Token) {
        Write-TestResult "List Tunnels" "SKIP" "No token available"
        return $false
    }

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/tunnels"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $count = ($response.Content.tunnels | Measure-Object).Count
        $details = "Total tunnels: $count"
        Write-TestResult "List Tunnels" "PASS" $details
        return $true
    } else {
        Write-TestResult "List Tunnels" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 7: Get Tunnel Details
function Test-GetTunnelDetails {
    Write-Host "Testing: Get Tunnel Details..." -ForegroundColor $White

    if (-not $script:Token -or -not $script:TunnelId) {
        Write-TestResult "Get Tunnel Details" "SKIP" "No token or tunnel ID available"
        return $false
    }

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/tunnels/$script:TunnelId"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $details = "Name: $($response.Content.name), Status: $($response.Content.status)"
        Write-TestResult "Get Tunnel Details" "PASS" $details
        return $true
    } else {
        Write-TestResult "Get Tunnel Details" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 8: Create API Key
function Test-CreateApiKey {
    Write-Host "Testing: Create API Key..." -ForegroundColor $White

    if (-not $script:Token) {
        Write-TestResult "Create API Key" "SKIP" "No token available"
        return $false
    }

    $body = @{
        name        = "Test API Key $(Get-Random)"
        description = "Test key for PowerShell script"
    }

    $response = Invoke-ApiRequest -Method "POST" -Endpoint "/api/api-keys" -Body $body

    if ($response.Success -and $response.StatusCode -eq 201) {
        $script:ApiKeyId = $response.Content.id
        $details = "Key: $($response.Content.key_prefix)..., Created: $($response.Content.created_at)"
        Write-TestResult "Create API Key" "PASS" $details
        return $true
    } else {
        Write-TestResult "Create API Key" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 9: Get Metrics
function Test-GetMetrics {
    Write-Host "Testing: Get Metrics (Phase 2)..." -ForegroundColor $White

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/metrics"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $metricCount = ($response.Content.metrics | Get-Member -MemberType NoteProperty).Count
        $details = "Metrics collected: $metricCount"
        Write-TestResult "Get Metrics" "PASS" $details
        return $true
    } else {
        Write-TestResult "Get Metrics" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 10: Get Alerts
function Test-GetAlerts {
    Write-Host "Testing: Get Alerts (Phase 2)..." -ForegroundColor $White

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/alerts"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $alertCount = $response.Content.active_alerts
        $details = "Active alerts: $alertCount"
        Write-TestResult "Get Alerts" "PASS" $details
        return $true
    } else {
        Write-TestResult "Get Alerts" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 11: Circuit Breaker Status
function Test-CircuitBreakerStatus {
    Write-Host "Testing: Circuit Breaker Status (Phase 2)..." -ForegroundColor $White

    $response = Invoke-ApiRequest -Method "GET" -Endpoint "/api/circuit-breaker/status"

    if ($response.Success -and $response.StatusCode -eq 200) {
        $dbState = $response.Content.database.state
        $details = "Database state: $dbState"
        Write-TestResult "Circuit Breaker Status" "PASS" $details
        return $true
    } else {
        Write-TestResult "Circuit Breaker Status" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Test 12: Delete Tunnel
function Test-DeleteTunnel {
    Write-Host "Testing: Delete Tunnel..." -ForegroundColor $White

    if (-not $script:Token -or -not $script:TunnelId) {
        Write-TestResult "Delete Tunnel" "SKIP" "No token or tunnel ID available"
        return $false
    }

    $response = Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/tunnels/$script:TunnelId"

    if ($response.Success -and $response.StatusCode -eq 204) {
        Write-TestResult "Delete Tunnel" "PASS" "Tunnel deleted successfully"
        return $true
    } else {
        Write-TestResult "Delete Tunnel" "FAIL" "HTTP $($response.StatusCode): $($response.Error)"
        return $false
    }
}

# Export results to JSON
function Export-TestResults {
    $jsonResults = @{
        timestamp      = (Get-Date).ToUniversalTime().ToString('O')
        base_url       = $script:BaseUrl
        total_tests    = @($script:TestResults).Count
        passed         = $script:TestsPassed
        failed         = $script:TestsFailed
        success_rate   = if (@($script:TestResults).Count -gt 0) {
            ([math]::Round(($script:TestsPassed / @($script:TestResults).Count) * 100, 2))
        } else { 0 }
        tests          = $script:TestResults
    }

    $jsonResults | ConvertTo-Json | Out-File -FilePath "test_results_$(Get-Date -Format 'yyyyMMdd_HHmmss').json" -Encoding UTF8
    Write-Host "Results saved to test_results_$(Get-Date -Format 'yyyyMMdd_HHmmss').json" -ForegroundColor $Yellow
}

# Main execution
function main {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor $Cyan
    Write-Host "║  UltraSlim API Test Client - Windows PowerShell Edition           ║" -ForegroundColor $Cyan
    Write-Host "║  Tests against live production API                                ║" -ForegroundColor $Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor $Cyan
    Write-Host ""

    Write-Host "Configuration:" -ForegroundColor $Cyan
    Write-Host "  Base URL:      $script:BaseUrl" -ForegroundColor $White
    Write-Host "  Admin Email:   $AdminEmail" -ForegroundColor $White
    Write-Host "  Timestamp:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $White
    Write-Host ""

    Write-Header "RUNNING TESTS"

    # Run all tests
    Test-HealthCheck
    Test-AdminLogin
    Test-UserSignup
    Test-GetProfile
    Test-CreateTunnel
    Test-ListTunnels
    Test-GetTunnelDetails
    Test-CreateApiKey
    Test-GetMetrics
    Test-GetAlerts
    Test-CircuitBreakerStatus
    Test-DeleteTunnel

    # Print summary
    Write-Header "TEST SUMMARY"

    $totalTests = @($script:TestResults).Count
    $successRate = if ($totalTests -gt 0) { [math]::Round(($script:TestsPassed / $totalTests) * 100, 2) } else { 0 }

    Write-Host "Total Tests:     $totalTests" -ForegroundColor $White
    Write-Host "Passed:          $($script:TestsPassed)" -ForegroundColor $Green
    Write-Host "Failed:          $($script:TestsFailed)" -ForegroundColor $(if ($script:TestsFailed -gt 0) { $Red } else { $Green })
    Write-Host "Success Rate:    $successRate%" -ForegroundColor $(if ($successRate -eq 100) { $Green } else { $Yellow })
    Write-Host ""

    if ($script:TestsFailed -eq 0) {
        Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor $Green
    } else {
        Write-Host "⚠️  Some tests failed. Review details above." -ForegroundColor $Yellow
    }

    Write-Host ""

    # Export results if requested
    if ($OutputJson) {
        Export-TestResults
    }

    # Display results table
    Write-Header "DETAILED RESULTS"
    $script:TestResults | Format-Table -AutoSize -Property @(
        @{Label = "Timestamp"; Expression = { $_.timestamp }; Width = 19 }
        @{Label = "Test Name"; Expression = { $_.name }; Width = 30 }
        @{Label = "Status"; Expression = { $_.status }; Width = 8 }
        @{Label = "Details"; Expression = { $_.details }; Width = 50 }
    )

    Write-Host "`n"
}

# Run main function
main
