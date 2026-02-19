#!/usr/bin/env node

/**
 * Real API Client Testing Script (Node.js)
 * Tests against live production API at https://21tunnel.com
 *
 * Usage: node test_client.js
 * Requirements: npm install node-fetch
 */

const fetch = typeof window === 'undefined' ? require('node-fetch') : window.fetch;

class APITestClient {
    constructor(baseUrl = 'https://21tunnel.com') {
        this.baseUrl = baseUrl;
        this.token = null;
        this.testResults = [];
    }

    logTest(name, status, details = '') {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        this.testResults.push({ timestamp, name, status, details });

        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
        console.log(`${statusIcon} [${timestamp}] ${name}: ${status}`);
        if (details) {
            console.log(`   Details: ${details}`);
        }
    }

    printHeader(text) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`  ${text}`);
        console.log(`${'='.repeat(70)}\n`);
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const data = response.status !== 204 ? await response.json() : {};
            return { status: response.status, data, headers: response.headers };
        } catch (error) {
            throw error;
        }
    }

    // Test 1: Health Check
    async testHealthCheck() {
        try {
            const { status, data } = await this.makeRequest('/api/health');

            if (status === 200) {
                const details = `Status: ${data.status}, Uptime: ${data.uptime}`;
                this.logTest('Health Check', 'PASS', details);
                console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
                return true;
            } else {
                this.logTest('Health Check', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Health Check', 'FAIL', e.message);
            return false;
        }
    }

    // Test 2: Login with valid credentials
    async testLoginValid() {
        try {
            const { status, data } = await this.makeRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'admin@ultraslim.dev',
                    password: 'TestPass123!'
                })
            });

            if (status === 200) {
                this.token = data.token;
                const userEmail = data.user?.email;
                this.logTest('Login (Valid Credentials)', 'PASS', `User: ${userEmail}`);
                console.log(`   Token obtained: ${this.token.substring(0, 30)}...`);
                return true;
            } else {
                this.logTest('Login (Valid Credentials)', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Login (Valid Credentials)', 'FAIL', e.message);
            return false;
        }
    }

    // Test 3: Login with invalid credentials
    async testLoginInvalid() {
        try {
            const { status, data } = await this.makeRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'admin@ultraslim.dev',
                    password: 'WrongPassword123!'
                })
            });

            if (status === 401) {
                const errorMsg = data.error || 'Unknown error';
                this.logTest('Login (Invalid Credentials)', 'PASS', `Correctly rejected: ${errorMsg}`);
                return true;
            } else {
                this.logTest('Login (Invalid Credentials)', 'FAIL', `Expected 401, got ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Login (Invalid Credentials)', 'FAIL', e.message);
            return false;
        }
    }

    // Test 4: Get user profile
    async testGetProfile() {
        if (!this.token) {
            this.logTest('Get Profile', 'SKIP', 'No token available');
            return false;
        }

        try {
            const { status, data } = await this.makeRequest('/api/profile', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (status === 200) {
                const userName = data.display_name;
                const userRole = data.role;
                this.logTest('Get Profile', 'PASS', `User: ${userName} (${userRole})`);
                console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
                return true;
            } else {
                this.logTest('Get Profile', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Get Profile', 'FAIL', e.message);
            return false;
        }
    }

    // Test 5: Get system metrics
    async testGetMetrics() {
        try {
            const { status, data } = await this.makeRequest('/api/metrics');

            if (status === 200) {
                const metricCount = Object.keys(data.metrics || {}).length;
                this.logTest('Get Metrics', 'PASS', `Metrics collected: ${metricCount}`);
                console.log(`   Sample metrics: ${Object.keys(data.metrics || {}).slice(0, 3).join(', ')}`);
                return true;
            } else {
                this.logTest('Get Metrics', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Get Metrics', 'FAIL', e.message);
            return false;
        }
    }

    // Test 6: Get alerts
    async testGetAlerts() {
        try {
            const { status, data } = await this.makeRequest('/api/alerts');

            if (status === 200) {
                const alertCount = data.active_alerts || 0;
                const statusStr = alertCount === 0 ? 'No alerts (System healthy)' : `${alertCount} active alerts`;
                this.logTest('Get Alerts', 'PASS', statusStr);
                return true;
            } else {
                this.logTest('Get Alerts', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Get Alerts', 'FAIL', e.message);
            return false;
        }
    }

    // Test 7: Get circuit breaker status
    async testCircuitBreakerStatus() {
        try {
            const { status, data } = await this.makeRequest('/api/circuit-breaker/status');

            if (status === 200) {
                const dbState = data.database?.state || 'unknown';
                const poolUtil = data.connection_pool?.utilization_percent || 0;
                this.logTest(
                    'Circuit Breaker Status',
                    'PASS',
                    `DB: ${dbState}, Pool: ${poolUtil.toFixed(1)}%`
                );
                return true;
            } else {
                this.logTest('Circuit Breaker Status', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Circuit Breaker Status', 'FAIL', e.message);
            return false;
        }
    }

    // Test 8: Missing authorization header
    async testMissingAuth() {
        try {
            const { status, data } = await this.makeRequest('/api/profile');

            if (status === 401) {
                const error = data.error;
                this.logTest(
                    'Missing Auth Header',
                    'PASS',
                    `Correctly rejected: ${error}`
                );
                return true;
            } else {
                this.logTest(
                    'Missing Auth Header',
                    'FAIL',
                    `Expected 401, got ${status}`
                );
                return false;
            }
        } catch (e) {
            this.logTest('Missing Auth Header', 'FAIL', e.message);
            return false;
        }
    }

    // Test 9: List tunnels
    async testListTunnels() {
        if (!this.token) {
            this.logTest('List Tunnels', 'SKIP', 'No token available');
            return false;
        }

        try {
            const { status, data } = await this.makeRequest('/api/tunnels', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (status === 200) {
                const tunnelCount = (data.tunnels || []).length;
                this.logTest('List Tunnels', 'PASS', `Tunnels: ${tunnelCount}`);
                return true;
            } else {
                this.logTest('List Tunnels', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('List Tunnels', 'FAIL', e.message);
            return false;
        }
    }

    // Test 10: Create API Key
    async testCreateAPIKey() {
        if (!this.token) {
            this.logTest('Create API Key', 'SKIP', 'No token available');
            return false;
        }

        try {
            const { status, data } = await this.makeRequest('/api/api-keys', {
                method: 'POST',
                body: JSON.stringify({
                    name: `test-key-${Date.now()}`
                }),
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (status === 201) {
                const keyPrefix = data.api_key?.key_prefix || 'unknown';
                this.logTest('Create API Key', 'PASS', `Key created: ${keyPrefix}`);
                return true;
            } else {
                this.logTest('Create API Key', 'FAIL', `HTTP ${status}`);
                return false;
            }
        } catch (e) {
            this.logTest('Create API Key', 'FAIL', e.message);
            return false;
        }
    }

    // Test 11: CORS headers
    async testCORSHeaders() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`, {
                headers: {
                    'Origin': 'https://21tunnel.com'
                }
            });

            if (response.status === 200) {
                const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
                if (corsOrigin) {
                    this.logTest('CORS Headers', 'PASS', `CORS origin allowed: ${corsOrigin}`);
                    return true;
                } else {
                    this.logTest('CORS Headers', 'FAIL', 'CORS headers missing');
                    return false;
                }
            } else {
                this.logTest('CORS Headers', 'FAIL', `HTTP ${response.status}`);
                return false;
            }
        } catch (e) {
            this.logTest('CORS Headers', 'FAIL', e.message);
            return false;
        }
    }

    // Test 12: Rate limiting
    async testRateLimiting() {
        try {
            let successCount = 0;
            let failureCount = 0;

            // Send 12 requests
            for (let i = 0; i < 12; i++) {
                const { status } = await this.makeRequest('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: 'admin@ultraslim.dev',
                        password: 'TestPass123!'
                    })
                });

                if (status === 200) {
                    successCount++;
                } else if (status === 429) {
                    failureCount++;
                }
            }

            if (successCount >= 10 && failureCount >= 2) {
                this.logTest(
                    'Rate Limiting',
                    'PASS',
                    `Success: ${successCount}, Rate Limited: ${failureCount}`
                );
                return true;
            } else {
                this.logTest(
                    'Rate Limiting',
                    'FAIL',
                    `Unexpected results: Success: ${successCount}, Failures: ${failureCount}`
                );
                return false;
            }
        } catch (e) {
            this.logTest('Rate Limiting', 'FAIL', e.message);
            return false;
        }
    }

    async runAllTests() {
        this.printHeader('ULTRASLIM API REAL CLIENT TESTING');
        console.log(`Target API: ${this.baseUrl}\n`);

        // System tests
        this.printHeader('1. SYSTEM & MONITORING TESTS');
        await this.testHealthCheck();
        await this.testGetMetrics();
        await this.testGetAlerts();
        await this.testCircuitBreakerStatus();

        // Authentication tests
        this.printHeader('2. AUTHENTICATION TESTS');
        await this.testLoginValid();
        await this.testLoginInvalid();
        await this.testMissingAuth();

        // Protected endpoint tests
        this.printHeader('3. PROTECTED ENDPOINT TESTS');
        await this.testGetProfile();
        await this.testListTunnels();
        await this.testCreateAPIKey();

        // Performance tests
        this.printHeader('4. RATE LIMITING & SECURITY TESTS');
        await this.testRateLimiting();
        await this.testCORSHeaders();

        this.printSummary();
    }

    printSummary() {
        this.printHeader('TEST SUMMARY');

        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const skipped = this.testResults.filter(r => r.status === 'SKIP').length;

        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Skipped: ${skipped} ⏭️`);
        console.log(`\nPass Rate: ${(passed / total * 100).toFixed(1)}%`);

        if (failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! API IS WORKING CORRECTLY');
        } else {
            console.log(`\n⚠️  ${failed} test(s) failed. Review details above.`);
        }

        // Save results
        const fs = require('fs');
        fs.writeFileSync('test_results.json', JSON.stringify(this.testResults, null, 2));
        console.log(`\nResults saved to: test_results.json`);
    }
}

// Run tests
(async () => {
    const client = new APITestClient();
    await client.runAllTests();
})().catch(console.error);
