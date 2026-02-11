import requests
import sys
import json
import os
import tempfile
from datetime import datetime

class DeliverableAPITester:
    def __init__(self, base_url="https://elearning-hub-30.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.admin_user = None
        self.test_project_id = None
        self.test_task_id = None
        self.test_deliverable_id = None
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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)
        
        # Don't set Content-Type for file uploads
        if not files:
            test_headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers=test_headers, timeout=10)
                else:
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

    def setup_test_environment(self):
        """Setup test environment with login and project/task creation"""
        print("🔧 Setting up test environment...")
        
        # Login with test credentials
        login_data = {
            "email": "admin_004921@test.com",  # Known admin from previous tests
            "password": "TestPass123!"
        }
        
        response = self.run_test("Admin Login", "POST", "auth/login", 200, login_data)
        if not response:
            return False
            
        self.token = response.get('token')
        self.admin_user = response.get('user')
        
        # Create test project
        project_data = {
            "name": "Deliverable Test Project",
            "client_name": "Test Client",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "modules": ["design", "tech"],
            "description": "Test project for deliverable functionality"
        }
        
        response = self.run_test("Create Test Project", "POST", "projects", 200, project_data)
        if not response:
            return False
            
        self.test_project_id = response.get('project', {}).get('id')
        
        # Get first task from the project
        response = self.run_test("Get Project Tasks", "GET", f"projects/{self.test_project_id}/tasks", 200)
        if response and len(response) > 0:
            self.test_task_id = response[0].get('id')
            self.log_test("Test Environment Setup", True, f"Project: {self.test_project_id}, Task: {self.test_task_id}")
            return True
        
        self.log_test("Test Environment Setup", False, "No tasks found in project")
        return False

    def test_get_task_deliverables(self):
        """Test GET /api/tasks/{id}/deliverables"""
        if not self.test_task_id:
            self.log_test("Get Task Deliverables", False, "No task ID available")
            return False
            
        response = self.run_test("Get Task Deliverables", "GET", f"tasks/{self.test_task_id}/deliverables", 200)
        if response and isinstance(response, list):
            self.log_test("Task Deliverables Structure", True, f"Found {len(response)} deliverables")
            return True
        return False

    def test_create_deliverable(self):
        """Test POST /api/tasks/{id}/deliverables"""
        if not self.test_task_id:
            self.log_test("Create Deliverable", False, "No task ID available")
            return False
            
        deliverable_data = {
            "task_id": self.test_task_id,
            "name": "Test Manual de Usuario",
            "description": "Manual de usuario en formato PDF",
            "due_date": "2024-06-30"
        }
        
        response = self.run_test("Create Deliverable", "POST", f"tasks/{self.test_task_id}/deliverables", 200, deliverable_data)
        if response:
            deliverable = response.get('deliverable')
            if deliverable:
                self.test_deliverable_id = deliverable.get('id')
                
                # Verify deliverable structure
                required_fields = ['id', 'name', 'status', 'due_date']
                missing_fields = [field for field in required_fields if field not in deliverable]
                
                if missing_fields:
                    self.log_test("Deliverable Structure", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Deliverable Structure", True)
                
                # Verify initial status is pending
                if deliverable.get('status') == 'pending':
                    self.log_test("Initial Deliverable Status", True, "Status: pending")
                else:
                    self.log_test("Initial Deliverable Status", False, f"Status: {deliverable.get('status')}")
                
                return True
        return False

    def test_update_deliverable(self):
        """Test PUT /api/tasks/{id}/deliverables/{id}"""
        if not self.test_task_id or not self.test_deliverable_id:
            self.log_test("Update Deliverable", False, "Missing task or deliverable ID")
            return False
            
        update_data = {
            "status": "in_review",
            "feedback": "Please review the document format and add more examples"
        }
        
        response = self.run_test("Update Deliverable", "PUT", f"tasks/{self.test_task_id}/deliverables/{self.test_deliverable_id}", 200, update_data)
        if response:
            # Verify the update by getting task deliverables
            response = self.run_test("Verify Deliverable Update", "GET", f"tasks/{self.test_task_id}/deliverables", 200)
            if response:
                updated_deliverable = next((d for d in response if d['id'] == self.test_deliverable_id), None)
                if updated_deliverable:
                    if updated_deliverable.get('status') == 'in_review':
                        self.log_test("Deliverable Status Update", True, "Status changed to in_review")
                    else:
                        self.log_test("Deliverable Status Update", False, f"Status: {updated_deliverable.get('status')}")
                    
                    if updated_deliverable.get('feedback') == update_data['feedback']:
                        self.log_test("Deliverable Feedback Update", True)
                    else:
                        self.log_test("Deliverable Feedback Update", False, f"Feedback: {updated_deliverable.get('feedback')}")
                    
                    return True
        return False

    def test_upload_deliverable_file(self):
        """Test POST /api/tasks/{id}/deliverables/{id}/upload"""
        if not self.test_task_id or not self.test_deliverable_id:
            self.log_test("Upload Deliverable File", False, "Missing task or deliverable ID")
            return False
            
        # Create a temporary test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            temp_file.write("This is a test deliverable file content.\nIt contains sample text for testing file upload functionality.")
            temp_file_path = temp_file.name
        
        try:
            with open(temp_file_path, 'rb') as file:
                files = {'file': ('test_deliverable.txt', file, 'text/plain')}
                
                response = self.run_test("Upload Deliverable File", "POST", f"tasks/{self.test_task_id}/deliverables/{self.test_deliverable_id}/upload", 200, files=files)
                
                if response:
                    file_url = response.get('file_url')
                    file_name = response.get('file_name')
                    
                    if file_url and file_name:
                        self.log_test("File Upload Response", True, f"File: {file_name}, URL: {file_url}")
                        
                        # Verify file was associated with deliverable
                        response = self.run_test("Verify File Association", "GET", f"tasks/{self.test_task_id}/deliverables", 200)
                        if response:
                            updated_deliverable = next((d for d in response if d['id'] == self.test_deliverable_id), None)
                            if updated_deliverable and updated_deliverable.get('file_url'):
                                self.log_test("File Association", True, f"File URL: {updated_deliverable.get('file_url')}")
                                return True
                            else:
                                self.log_test("File Association", False, "File URL not found in deliverable")
                    else:
                        self.log_test("File Upload Response", False, "Missing file_url or file_name")
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
        return False

    def test_get_project_deliverables(self):
        """Test GET /api/projects/{id}/deliverables"""
        if not self.test_project_id:
            self.log_test("Get Project Deliverables", False, "No project ID available")
            return False
            
        response = self.run_test("Get Project Deliverables", "GET", f"projects/{self.test_project_id}/deliverables", 200)
        if response and isinstance(response, list):
            # Should include our test deliverable
            test_deliverable = next((d for d in response if d.get('id') == self.test_deliverable_id), None)
            if test_deliverable:
                self.log_test("Project Deliverables Include Task Deliverable", True)
                
                # Verify additional fields for project view
                required_fields = ['task_id', 'task_title', 'module_id']
                missing_fields = [field for field in required_fields if field not in test_deliverable]
                
                if missing_fields:
                    self.log_test("Project Deliverable Structure", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Project Deliverable Structure", True)
                
                return True
            else:
                self.log_test("Project Deliverables Include Task Deliverable", False, "Test deliverable not found")
        return False

    def test_deliverable_status_workflow(self):
        """Test complete deliverable status workflow"""
        if not self.test_task_id or not self.test_deliverable_id:
            self.log_test("Deliverable Status Workflow", False, "Missing task or deliverable ID")
            return False
            
        # Test status transitions: pending -> in_review -> approved
        statuses = [
            ("in_review", "Document uploaded and ready for review"),
            ("approved", "Document approved with minor suggestions"),
            ("rejected", "Please revise the document structure")
        ]
        
        for status, feedback in statuses:
            update_data = {
                "status": status,
                "feedback": feedback
            }
            
            response = self.run_test(f"Update Status to {status}", "PUT", f"tasks/{self.test_task_id}/deliverables/{self.test_deliverable_id}", 200, update_data)
            if response:
                # Verify the status change
                response = self.run_test(f"Verify Status {status}", "GET", f"tasks/{self.test_task_id}/deliverables", 200)
                if response:
                    updated_deliverable = next((d for d in response if d['id'] == self.test_deliverable_id), None)
                    if updated_deliverable and updated_deliverable.get('status') == status:
                        self.log_test(f"Status Workflow - {status}", True)
                        
                        # Check if reviewed_by and reviewed_at are set for approved/rejected
                        if status in ['approved', 'rejected']:
                            if updated_deliverable.get('reviewed_by') and updated_deliverable.get('reviewed_at'):
                                self.log_test(f"Review Metadata - {status}", True)
                            else:
                                self.log_test(f"Review Metadata - {status}", False, "Missing reviewed_by or reviewed_at")
                    else:
                        self.log_test(f"Status Workflow - {status}", False, f"Status: {updated_deliverable.get('status') if updated_deliverable else 'None'}")
                        return False
            else:
                return False
        
        return True

    def test_delete_deliverable(self):
        """Test DELETE /api/tasks/{id}/deliverables/{id}"""
        if not self.test_task_id or not self.test_deliverable_id:
            self.log_test("Delete Deliverable", False, "Missing task or deliverable ID")
            return False
            
        response = self.run_test("Delete Deliverable", "DELETE", f"tasks/{self.test_task_id}/deliverables/{self.test_deliverable_id}", 200)
        if response:
            # Verify deletion
            response = self.run_test("Verify Deliverable Deletion", "GET", f"tasks/{self.test_task_id}/deliverables", 200)
            if response:
                deleted_deliverable = next((d for d in response if d['id'] == self.test_deliverable_id), None)
                if not deleted_deliverable:
                    self.log_test("Deliverable Deletion Verification", True, "Deliverable successfully removed")
                    return True
                else:
                    self.log_test("Deliverable Deletion Verification", False, "Deliverable still exists")
        return False

    def test_file_download_access(self):
        """Test file download endpoint"""
        # First create a new deliverable and upload a file
        deliverable_data = {
            "task_id": self.test_task_id,
            "name": "Download Test File",
            "description": "Test file for download functionality"
        }
        
        response = self.run_test("Create Deliverable for Download Test", "POST", f"tasks/{self.test_task_id}/deliverables", 200, deliverable_data)
        if not response:
            return False
            
        download_deliverable_id = response.get('deliverable', {}).get('id')
        
        # Upload a file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
            temp_file.write("Download test content")
            temp_file_path = temp_file.name
        
        try:
            with open(temp_file_path, 'rb') as file:
                files = {'file': ('download_test.txt', file, 'text/plain')}
                
                response = self.run_test("Upload File for Download Test", "POST", f"tasks/{self.test_task_id}/deliverables/{download_deliverable_id}/upload", 200, files=files)
                
                if response:
                    file_url = response.get('file_url')
                    if file_url:
                        # Test file download
                        try:
                            download_url = f"{self.base_url}{file_url}"
                            headers = {'Authorization': f'Bearer {self.token}'}
                            download_response = requests.get(download_url, headers=headers, timeout=10)
                            
                            if download_response.status_code == 200:
                                self.log_test("File Download Access", True, f"Downloaded {len(download_response.content)} bytes")
                                return True
                            else:
                                self.log_test("File Download Access", False, f"Status: {download_response.status_code}")
                        except Exception as e:
                            self.log_test("File Download Access", False, f"Exception: {str(e)}")
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
        return False

    def run_all_tests(self):
        """Run comprehensive deliverable API tests"""
        print("🚀 Starting Deliverable Repository API Tests")
        print("=" * 60)
        
        # Setup test environment
        if not self.setup_test_environment():
            print("❌ Failed to setup test environment")
            return 1
        
        # Test deliverable CRUD operations
        self.test_get_task_deliverables()
        
        if self.test_create_deliverable():
            self.test_update_deliverable()
            self.test_upload_deliverable_file()
            self.test_get_project_deliverables()
            self.test_deliverable_status_workflow()
            self.test_file_download_access()
            # Note: Delete test is last as it removes the test deliverable
            self.test_delete_deliverable()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 Excellent! Deliverable repository is working perfectly!")
            return 0
        elif success_rate >= 70:
            print("✅ Good! Most deliverable functionality working")
            return 0
        else:
            print("⚠️  Multiple issues found with deliverable functionality")
            return 1

def main():
    tester = DeliverableAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())