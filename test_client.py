#!/usr/bin/env python3
"""
Real API Client Testing Script
Tests against live production API at https://tunnel.networkershome.com
"""

import requests
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime

class APITestClient:
    def __init__(self, base_url='https://tunnel.networkershome.com'):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
        self.test_results = []

    def log_test(self, name: str, status: str, details: str = ""):
        """Log test result"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        result = {
            'timestamp': timestamp,
            'name': name,
            'status': status,
            'details': details
        }
        self.test_results.append(result)
        status_icon = '✅' if status == 'PASS' else '❌'
        print(f"{status_icon} [{timestamp}] {name}: {status}")
        if details:
            print(f"   Details: {details}")

    def print_header(self, text: str):
        """Print section header"""
        print(f"\n{'='*70}")
        print(f"  {text}")
        print(f"{'='*70}\n")

    # Test 1: Health Check
    def test_health_check(self) -> bool:
        """Test API health endpoint"""
        try:
            response = self.session.get(f'{self.base_url}/api/health')

            if response.status_code == 200:
                data = response.json()
                details = f"Status: {data.get('status')}, Uptime: {data.get('uptime')}"
                self.log_test("Health Check", "PASS", details)
                print(f"   Response: {json.dumps(data, indent=2)}")
                return True
            else:
                self.log_test("Health Check", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check", "FAIL", str(e))
            return False

    # Test 2: Login with valid credentials
    def test_login_valid(self) -> bool:
        """Test login with valid credentials"""
        try:
            response = self.session.post(
                f'{self.base_url}/api/auth/login',
                json={
                    'email': 'admin@ultraslim.dev',
                    'password': 'TestPass123!'
                }
            )

            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                user_email = data.get('user', {}).get('email')
                self.log_test("Login (Valid Credentials)", "PASS", f"User: {user_email}")
                print(f"   Token obtained: {self.token[:30]}...")
                return True
            else:
                self.log_test("Login (Valid Credentials)", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Login (Valid Credentials)", "FAIL", str(e))
            return False

    # Test 3: Login with invalid credentials
    def test_login_invalid(self) -> bool:
        """Test login with invalid password"""
        try:
            response = self.session.post(
                f'{self.base_url}/api/auth/login',
                json={
                    'email': 'admin@ultraslim.dev',
                    'password': 'WrongPassword123!'
                }
            )

            if response.status_code == 401:
                data = response.json()
                error_msg = data.get('error', 'Unknown error')
                self.log_test("Login (Invalid Credentials)", "PASS", f"Correctly rejected: {error_msg}")
                return True
            else:
                self.log_test("Login (Invalid Credentials)", "FAIL", f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Login (Invalid Credentials)", "FAIL", str(e))
            return False

    # Test 4: Get user profile
    def test_get_profile(self) -> bool:
        """Test getting user profile"""
        if not self.token:
            self.log_test("Get Profile", "SKIP", "No token available")
            return False

        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = self.session.get(
                f'{self.base_url}/api/profile',
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                user_name = data.get('display_name')
                user_role = data.get('role')
                self.log_test("Get Profile", "PASS", f"User: {user_name} ({user_role})")
                print(f"   Response: {json.dumps(data, indent=2)}")
                return True
            else:
                self.log_test("Get Profile", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Profile", "FAIL", str(e))
            return False

    # Test 5: Get system metrics
    def test_get_metrics(self) -> bool:
        """Test getting system metrics"""
        try:
            response = self.session.get(f'{self.base_url}/api/metrics')

            if response.status_code == 200:
                data = response.json()
                metric_count = len(data.get('metrics', {}))
                self.log_test("Get Metrics", "PASS", f"Metrics collected: {metric_count}")
                print(f"   Sample metrics: {list(data.get('metrics', {}).keys())[:3]}")
                return True
            else:
                self.log_test("Get Metrics", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Metrics", "FAIL", str(e))
            return False

    # Test 6: Get alerts
    def test_get_alerts(self) -> bool:
        """Test getting active alerts"""
        try:
            response = self.session.get(f'{self.base_url}/api/alerts')

            if response.status_code == 200:
                data = response.json()
                alert_count = data.get('active_alerts', 0)
                status = "No alerts (System healthy)" if alert_count == 0 else f"{alert_count} active alerts"
                self.log_test("Get Alerts", "PASS", status)
                return True
            else:
                self.log_test("Get Alerts", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Alerts", "FAIL", str(e))
            return False

    # Test 7: Get circuit breaker status
    def test_circuit_breaker_status(self) -> bool:
        """Test getting circuit breaker status"""
        try:
            response = self.session.get(f'{self.base_url}/api/circuit-breaker/status')

            if response.status_code == 200:
                data = response.json()
                db_state = data.get('database', {}).get('state', 'unknown')
                pool_util = data.get('connection_pool', {}).get('utilization_percent', 0)
                self.log_test(
                    "Circuit Breaker Status",
                    "PASS",
                    f"DB: {db_state}, Pool: {pool_util:.1f}%"
                )
                return True
            else:
                self.log_test("Circuit Breaker Status", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Circuit Breaker Status", "FAIL", str(e))
            return False

    # Test 8: Missing authorization header
    def test_missing_auth(self) -> bool:
        """Test that protected endpoint requires auth"""
        try:
            response = self.session.get(f'{self.base_url}/api/profile')

            if response.status_code == 401:
                data = response.json()
                error = data.get('error')
                self.log_test(
                    "Missing Auth Header",
                    "PASS",
                    f"Correctly rejected: {error}"
                )
                return True
            else:
                self.log_test(
                    "Missing Auth Header",
                    "FAIL",
                    f"Expected 401, got {response.status_code}"
                )
                return False
        except Exception as e:
            self.log_test("Missing Auth Header", "FAIL", str(e))
            return False

    # Test 9: List tunnels
    def test_list_tunnels(self) -> bool:
        """Test listing user tunnels"""
        if not self.token:
            self.log_test("List Tunnels", "SKIP", "No token available")
            return False

        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            response = self.session.get(
                f'{self.base_url}/api/tunnels',
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                tunnel_count = len(data.get('tunnels', []))
                self.log_test("List Tunnels", "PASS", f"Tunnels: {tunnel_count}")
                return True
            else:
                self.log_test("List Tunnels", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("List Tunnels", "FAIL", str(e))
            return False

    # Test 10: Rate limiting
    def test_rate_limiting(self) -> bool:
        """Test rate limiting on login endpoint"""
        try:
            success_count = 0
            failure_count = 0

            # Send 12 requests
            for i in range(12):
                response = self.session.post(
                    f'{self.base_url}/api/auth/login',
                    json={
                        'email': 'admin@ultraslim.dev',
                        'password': 'TestPass123!'
                    }
                )

                if response.status_code == 200:
                    success_count += 1
                elif response.status_code == 429:
                    failure_count += 1

            # Should have 10 successes and 2+ failures (rate limited)
            if success_count >= 10 and failure_count >= 2:
                self.log_test(
                    "Rate Limiting",
                    "PASS",
                    f"Success: {success_count}, Rate Limited: {failure_count}"
                )
                return True
            else:
                self.log_test(
                    "Rate Limiting",
                    "FAIL",
                    f"Unexpected results: Success: {success_count}, Failures: {failure_count}"
                )
                return False
        except Exception as e:
            self.log_test("Rate Limiting", "FAIL", str(e))
            return False

    # Test 11: Create API Key
    def test_create_api_key(self) -> bool:
        """Test creating an API key"""
        if not self.token:
            self.log_test("Create API Key", "SKIP", "No token available")
            return False

        try:
            headers = {
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json'
            }
            response = self.session.post(
                f'{self.base_url}/api/api-keys',
                json={'name': f'test-key-{datetime.now().timestamp()}'},
                headers=headers
            )

            if response.status_code == 201:
                data = response.json()
                key_prefix = data.get('api_key', {}).get('key_prefix', 'unknown')
                self.log_test("Create API Key", "PASS", f"Key created: {key_prefix}")
                return True
            else:
                self.log_test("Create API Key", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Create API Key", "FAIL", str(e))
            return False

    # Test 12: CORS headers
    def test_cors_headers(self) -> bool:
        """Test CORS headers"""
        try:
            headers = {'Origin': 'https://tunnel.networkershome.com'}
            response = self.session.get(
                f'{self.base_url}/api/health',
                headers=headers
            )

            if response.status_code == 200:
                cors_origin = response.headers.get('Access-Control-Allow-Origin')
                if cors_origin:
                    self.log_test("CORS Headers", "PASS", f"CORS origin allowed: {cors_origin}")
                    return True
                else:
                    self.log_test("CORS Headers", "FAIL", "CORS headers missing")
                    return False
            else:
                self.log_test("CORS Headers", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("CORS Headers", "FAIL", str(e))
            return False

    def run_all_tests(self):
        """Run all tests"""
        self.print_header("ULTRASLIM API REAL CLIENT TESTING")
        print(f"Target API: {self.base_url}\n")

        # System tests
        self.print_header("1. SYSTEM & MONITORING TESTS")
        self.test_health_check()
        self.test_get_metrics()
        self.test_get_alerts()
        self.test_circuit_breaker_status()

        # Authentication tests
        self.print_header("2. AUTHENTICATION TESTS")
        self.test_login_valid()
        self.test_login_invalid()
        self.test_missing_auth()

        # Protected endpoint tests
        self.print_header("3. PROTECTED ENDPOINT TESTS")
        self.test_get_profile()
        self.test_list_tunnels()
        self.test_create_api_key()

        # Performance tests
        self.print_header("4. RATE LIMITING & SECURITY TESTS")
        self.test_rate_limiting()
        self.test_cors_headers()

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        self.print_header("TEST SUMMARY")

        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r['status'] == 'PASS')
        failed = sum(1 for r in self.test_results if r['status'] == 'FAIL')
        skipped = sum(1 for r in self.test_results if r['status'] == 'SKIP')

        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {failed} ❌")
        print(f"Skipped: {skipped} ⏭️")
        print(f"\nPass Rate: {(passed/total*100):.1f}%")

        if failed == 0:
            print("\n🎉 ALL TESTS PASSED! API IS WORKING CORRECTLY")
        else:
            print(f"\n⚠️  {failed} test(s) failed. Review details above.")

        # Save results
        with open('test_results.json', 'w') as f:
            json.dump(self.test_results, f, indent=2)
        print(f"\nResults saved to: test_results.json")


if __name__ == '__main__':
    client = APITestClient()
    client.run_all_tests()
