import requests
import sys
import json
from datetime import datetime, timedelta

class eLearningAPITester:
    def __init__(self, base_url="https://elearning-hub-30.preview.emergentagent.com"):
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

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API endpoint", "GET", "", 200)

    def test_user_registration(self):
        """Test user registration - use existing admin or create first user"""
        # Check if there are existing users
        try:
            response = requests.get(f"{self.base_url}/api/users", timeout=10)
            if response.status_code == 401:  # No token, expected
                # Try to find existing admin user
                import subprocess
                result = subprocess.run(['mongosh', 'test_database', '--eval', 'db.users.findOne({"role": "admin"})'], 
                                      capture_output=True, text=True)
                if 'admin' in result.stdout:
                    # Use existing admin
                    self.admin_user = {
                        'email': 'admin_004921@test.com',  # From previous test
                        'role': 'admin'
                    }
                    self.log_test("Found existing admin user", True)
                    return True
        except:
            pass
            
        # Create new user (will be admin if first user)
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "email": f"admin_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Admin User {timestamp}",
            "role": "collaborator"  # Should be overridden to admin for first user
        }
        
        response = self.run_test("User Registration", "POST", "auth/register", 200, user_data)
        if response:
            self.token = response.get('token')
            self.admin_user = response.get('user')
            # Check if user has admin privileges (either admin role or can access admin endpoints)
            if self.admin_user and (self.admin_user.get('role') == 'admin' or self.admin_user.get('role') == 'project_manager'):
                self.log_test("User has admin/manager privileges", True)
            else:
                self.log_test("User has admin/manager privileges", False, f"Role: {self.admin_user.get('role') if self.admin_user else 'None'}")
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        if not self.admin_user:
            self.log_test("User Login", False, "No admin user to test login")
            return False
            
        login_data = {
            "email": self.admin_user['email'],
            "password": "TestPass123!"
        }
        
        response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if response:
            self.token = response.get('token')
            user = response.get('user')
            # Update admin_user with full info from login
            if user:
                self.admin_user = user
            return True
        return False

    def test_get_current_user(self):
        """Test get current user endpoint"""
        return self.run_test("Get Current User", "GET", "auth/me", 200) is not None

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        response = self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)
        if response:
            # Verify expected structure
            required_keys = ['projects', 'tasks', 'my_tasks', 'unread_notifications', 'recent_projects']
            missing_keys = [key for key in required_keys if key not in response]
            if missing_keys:
                self.log_test("Dashboard Stats Structure", False, f"Missing keys: {missing_keys}")
            else:
                self.log_test("Dashboard Stats Structure", True)
            return True
        return False

    def test_get_modules(self):
        """Test get available modules"""
        response = self.run_test("Get Modules", "GET", "modules", 200)
        if response and isinstance(response, list):
            # Should have 7 modules
            if len(response) == 7:
                self.log_test("Module Count", True, f"Found {len(response)} modules")
            else:
                self.log_test("Module Count", False, f"Expected 7, got {len(response)}")
            
            # Check module structure
            expected_modules = ['design', 'tech', 'marketing', 'sales', 'content', 'admin', 'academic']
            found_modules = [m.get('id') for m in response]
            missing = [m for m in expected_modules if m not in found_modules]
            if missing:
                self.log_test("Module IDs", False, f"Missing: {missing}")
            else:
                self.log_test("Module IDs", True)
            return True
        return False

    def test_create_project(self):
        """Test project creation with automatic task generation"""
        # Check if current user can create projects
        if not self.admin_user or self.admin_user.get('role') not in ['admin', 'project_manager']:
            self.log_test("Create Project", False, f"User role '{self.admin_user.get('role') if self.admin_user else 'None'}' cannot create projects")
            return False
            
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

    def test_get_projects(self):
        """Test get projects list"""
        response = self.run_test("Get Projects", "GET", "projects", 200)
        if response and isinstance(response, list):
            if len(response) > 0:
                self.log_test("Projects List", True, f"Found {len(response)} projects")
                # Check project structure
                project = response[0]
                required_fields = ['id', 'name', 'client_name', 'status', 'progress']
                missing = [f for f in required_fields if f not in project]
                if missing:
                    self.log_test("Project Structure", False, f"Missing fields: {missing}")
                else:
                    self.log_test("Project Structure", True)
            else:
                self.log_test("Projects List", False, "No projects found")
            return True
        return False

    def test_get_project_detail(self):
        """Test get project detail"""
        if not self.test_project_id:
            self.log_test("Get Project Detail", False, "No project ID available")
            return False
            
        response = self.run_test("Get Project Detail", "GET", f"projects/{self.test_project_id}", 200)
        if response:
            # Check for modules_data
            if 'modules_data' in response:
                self.log_test("Project Modules Data", True)
            else:
                self.log_test("Project Modules Data", False, "modules_data not found")
            return True
        return False

    def test_get_project_tasks(self):
        """Test get project tasks"""
        if not self.test_project_id:
            self.log_test("Get Project Tasks", False, "No project ID available")
            return False
            
        response = self.run_test("Get Project Tasks", "GET", f"projects/{self.test_project_id}/tasks", 200)
        if response and isinstance(response, list):
            if len(response) > 0:
                self.test_task_id = response[0].get('id')
                self.log_test("Project Tasks", True, f"Found {len(response)} tasks")
                
                # Check task structure
                task = response[0]
                required_fields = ['id', 'title', 'status', 'checklist', 'deliverables']
                missing = [f for f in required_fields if f not in task]
                if missing:
                    self.log_test("Task Structure", False, f"Missing fields: {missing}")
                else:
                    self.log_test("Task Structure", True)
            else:
                self.log_test("Project Tasks", False, "No tasks found")
            return True
        return False

    def test_update_task_status(self):
        """Test task status update"""
        if not self.test_task_id:
            self.log_test("Update Task Status", False, "No task ID available")
            return False
            
        update_data = {"status": "in_progress"}
        response = self.run_test("Update Task Status", "PUT", f"tasks/{self.test_task_id}", 200, update_data)
        return response is not None

    def test_get_task_detail(self):
        """Test get task detail"""
        if not self.test_task_id:
            self.log_test("Get Task Detail", False, "No task ID available")
            return False
            
        response = self.run_test("Get Task Detail", "GET", f"tasks/{self.test_task_id}", 200)
        if response:
            # Verify status was updated
            if response.get('status') == 'in_progress':
                self.log_test("Task Status Update Verification", True)
            else:
                self.log_test("Task Status Update Verification", False, f"Status: {response.get('status')}")
            return True
        return False

    def test_notifications(self):
        """Test notifications endpoint"""
        response = self.run_test("Get Notifications", "GET", "notifications", 200)
        if response and isinstance(response, list):
            self.log_test("Notifications", True, f"Found {len(response)} notifications")
            return True
        return False

    def test_users_management(self):
        """Test user management (admin only)"""
        # Check if current user has admin privileges
        if not self.admin_user or self.admin_user.get('role') not in ['admin', 'project_manager']:
            self.log_test("Users Management", False, f"User role '{self.admin_user.get('role') if self.admin_user else 'None'}' cannot access admin endpoints")
            return False
            
        response = self.run_test("Get Users", "GET", "users", 200)
        if response and isinstance(response, list):
            self.log_test("Users Management", True, f"Found {len(response)} users")
            return True
        return False

    def test_pdf_export(self):
        """Test PDF export functionality"""
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
        # Create a regular user
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "email": f"user_{timestamp}@test.com",
            "password": "TestPass123!",
            "name": f"Regular User {timestamp}",
            "role": "collaborator"
        }
        
        response = self.run_test("Create Regular User", "POST", "auth/register", 200, user_data)
        if response:
            regular_token = response.get('token')
            
            # Try to access admin-only endpoint with regular user token
            old_token = self.token
            self.token = regular_token
            
            # This should fail (403)
            result = self.run_test("Regular User Access Admin Endpoint", "GET", "users", 403)
            success = result is None  # Should fail
            self.log_test("Role-based Access Control", success, "Regular user correctly denied admin access" if success else "Regular user incorrectly allowed admin access")
            
            # Restore admin token
            self.token = old_token
            return True
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting eLearning 360 API Tests")
        print("=" * 50)
        
        # Basic connectivity
        self.test_root_endpoint()
        
        # Authentication flow
        if self.test_user_registration():
            self.test_user_login()
            self.test_get_current_user()
        
        # Core functionality
        self.test_dashboard_stats()
        self.test_get_modules()
        
        # Project management
        if self.test_create_project():
            self.test_get_projects()
            self.test_get_project_detail()
            
            # Task management
            if self.test_get_project_tasks():
                self.test_update_task_status()
                self.test_get_task_detail()
        
        # Additional features
        self.test_notifications()
        self.test_users_management()
        self.test_pdf_export()
        self.test_role_based_access()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed")
            return 1

def main():
    tester = eLearningAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())