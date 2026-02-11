import requests
import sys
import json
from datetime import datetime, timedelta

class eLearningAPITester:
    def __init__(self, base_url="https://elearning-admin.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.admin_user = None
        self.test_project_id = None
        self.test_task_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    details += f", Error: {error_detail}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {"success": True}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_login_existing_admin(self):
        """Login with existing admin user"""
        login_data = {
            "email": "admin_004921@test.com",  # Known admin from previous tests
            "password": "TestPass123!"
        }
        
        response = self.run_test("Admin Login", "POST", "auth/login", 200, login_data)
        if response:
            self.token = response.get('token')
            self.admin_user = response.get('user')
            if self.admin_user.get('role') == 'admin':
                self.log_test("Admin Role Verified", True)
            else:
                self.log_test("Admin Role Verified", False, f"Role: {self.admin_user.get('role')}")
            return True
        return False

    def test_user_registration_flow(self):
        """Test new user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "email": f"newuser_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"New User {timestamp}",
            "role": "collaborator"
        }
        
        response = self.run_test("New User Registration", "POST", "auth/register", 200, user_data)
        if response:
            new_user = response.get('user')
            if new_user.get('role') == 'collaborator':
                self.log_test("New User Role Correct", True, "Role: collaborator")
            else:
                self.log_test("New User Role Correct", False, f"Role: {new_user.get('role')}")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        response = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        if response:
            required_keys = ['projects', 'tasks', 'my_tasks', 'unread_notifications', 'recent_projects']
            missing_keys = [key for key in required_keys if key not in response]
            if missing_keys:
                self.log_test("Dashboard Stats Structure", False, f"Missing keys: {missing_keys}")
            else:
                self.log_test("Dashboard Stats Structure", True)
            return True
        return False

    def test_modules(self):
        """Test get available modules"""
        response = self.run_test("Get Modules", "GET", "modules", 200)
        if response and isinstance(response, list):
            if len(response) == 7:
                self.log_test("Module Count", True, f"Found {len(response)} modules")
            else:
                self.log_test("Module Count", False, f"Expected 7, got {len(response)}")
            
            expected_modules = ['design', 'tech', 'marketing', 'sales', 'content', 'admin', 'academic']
            found_modules = [m.get('id') for m in response]
            missing = [m for m in expected_modules if m not in found_modules]
            if missing:
                self.log_test("Module IDs", False, f"Missing: {missing}")
            else:
                self.log_test("Module IDs", True)
            return True
        return False

    def test_project_creation(self):
        """Test project creation and task generation"""
        project_data = {
            "name": "Test eLearning Project",
            "client_name": "Test University",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "modules": ["design", "tech", "marketing"],
            "description": "Test project for API testing"
        }
        
        response = self.run_test("Create Project", "POST", "projects", 200, project_data)
        if response:
            self.test_project_id = response.get('project', {}).get('id')
            tasks_created = response.get('tasks_created', 0)
            
            if tasks_created > 0:
                self.log_test("Automatic Task Generation", True, f"Created {tasks_created} tasks")
            else:
                self.log_test("Automatic Task Generation", False, "No tasks created")
            return True
        return False

    def test_project_management(self):
        """Test project list and detail"""
        # Test project list
        response = self.run_test("Get Projects", "GET", "projects", 200)
        if response and isinstance(response, list) and len(response) > 0:
            self.log_test("Projects List", True, f"Found {len(response)} projects")
            
            # Test project detail
            if self.test_project_id:
                response = self.run_test("Get Project Detail", "GET", f"projects/{self.test_project_id}", 200)
                if response and 'modules_data' in response:
                    self.log_test("Project Detail Structure", True)
                    return True
                else:
                    self.log_test("Project Detail Structure", False, "modules_data not found")
        return False

    def test_task_management(self):
        """Test task operations"""
        if not self.test_project_id:
            self.log_test("Task Management", False, "No project ID available")
            return False
            
        # Get project tasks
        response = self.run_test("Get Project Tasks", "GET", f"projects/{self.test_project_id}/tasks", 200)
        if response and isinstance(response, list) and len(response) > 0:
            self.test_task_id = response[0].get('id')
            self.log_test("Project Tasks", True, f"Found {len(response)} tasks")
            
            # Update task status
            update_data = {"status": "in_progress"}
            response = self.run_test("Update Task Status", "PUT", f"tasks/{self.test_task_id}", 200, update_data)
            if response:
                # Verify update
                response = self.run_test("Get Task Detail", "GET", f"tasks/{self.test_task_id}", 200)
                if response and response.get('status') == 'in_progress':
                    self.log_test("Task Status Update", True)
                    return True
                else:
                    self.log_test("Task Status Update", False, f"Status: {response.get('status') if response else 'None'}")
        return False

    def test_notifications(self):
        """Test notifications"""
        response = self.run_test("Get Notifications", "GET", "notifications", 200)
        if response and isinstance(response, list):
            self.log_test("Notifications", True, f"Found {len(response)} notifications")
            return True
        return False

    def test_user_management(self):
        """Test admin user management"""
        response = self.run_test("Get Users (Admin)", "GET", "users", 200)
        if response and isinstance(response, list):
            self.log_test("User Management", True, f"Found {len(response)} users")
            return True
        return False

    def test_pdf_export(self):
        """Test PDF export"""
        if not self.test_project_id:
            self.log_test("PDF Export", False, "No project ID available")
            return False
            
        try:
            url = f"{self.base_url}/api/projects/{self.test_project_id}/export-pdf"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200 and response.headers.get('content-type') == 'application/pdf':
                self.log_test("PDF Export", True, f"PDF size: {len(response.content)} bytes")
                return True
            else:
                self.log_test("PDF Export", False, f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
                return False
        except Exception as e:
            self.log_test("PDF Export", False, f"Exception: {str(e)}")
            return False

    def test_role_based_access(self):
        """Test role-based access control"""
        # Create regular user
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "email": f"regular_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Regular User {timestamp}",
            "role": "collaborator"
        }
        
        response = self.run_test("Create Regular User", "POST", "auth/register", 200, user_data)
        if response:
            regular_token = response.get('token')
            
            # Test access with regular user
            old_token = self.token
            self.token = regular_token
            
            # Should be denied access to admin endpoint
            try:
                url = f"{self.base_url}/api/users"
                headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 403:
                    self.log_test("Role-based Access Control", True, "Regular user correctly denied")
                else:
                    self.log_test("Role-based Access Control", False, f"Expected 403, got {response.status_code}")
            except Exception as e:
                self.log_test("Role-based Access Control", False, f"Exception: {str(e)}")
            
            # Restore admin token
            self.token = old_token
            return True
        return False

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting eLearning 360 API Tests")
        print("=" * 50)
        
        # Authentication with existing admin
        if not self.test_login_existing_admin():
            print("❌ Cannot login as admin, stopping tests")
            return 1
        
        # Test user registration flow
        self.test_user_registration_flow()
        
        # Core functionality tests
        self.test_dashboard_stats()
        self.test_modules()
        
        # Project management tests
        if self.test_project_creation():
            self.test_project_management()
            self.test_task_management()
        
        # Additional features
        self.test_notifications()
        self.test_user_management()
        self.test_pdf_export()
        self.test_role_based_access()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 Excellent! Most tests passed!")
            return 0
        elif success_rate >= 70:
            print("✅ Good! Most functionality working")
            return 0
        else:
            print("⚠️  Multiple issues found")
            return 1

def main():
    tester = eLearningAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())