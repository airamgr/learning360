"""
Admin Panel API Tests - eLearning 360 Project Manager
Tests for: Users, Roles, User Types, Modules, and Task Templates CRUD operations
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "Admin123!"


class TestAdminAuthentication:
    """Test admin authentication and access"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        return data["token"]
    
    def test_admin_login_success(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
    
    def test_admin_stats_endpoint(self, admin_token):
        """Test admin stats endpoint returns correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected fields are present
        assert "users" in data
        assert "projects" in data
        assert "tasks" in data
        assert "modules" in data
        assert "user_types" in data
        assert "roles" in data
        
        # Verify values are integers
        assert isinstance(data["users"], int)
        assert isinstance(data["modules"], int)
        print(f"Admin stats: {data}")


class TestUsersTab:
    """Test Users Tab - View, edit user role/type, delete user"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_user_id(self, admin_token):
        """Create a test user for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register a new user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "TEST User For Admin",
            "role": "collaborator",
            "user_type": "comercial"
        })
        
        if response.status_code == 200:
            return response.json()["user"]["id"]
        return None
    
    def test_get_users_list(self, admin_token):
        """Test getting list of all users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Verify user structure
        for user in users:
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
        
        print(f"Found {len(users)} users")
    
    def test_update_user_role(self, admin_token, test_user_id):
        """Test updating user role"""
        if not test_user_id:
            pytest.skip("Test user not created")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update user role to project_manager
        response = requests.put(f"{BASE_URL}/api/users/{test_user_id}", 
            headers=headers,
            json={"role": "project_manager"}
        )
        assert response.status_code == 200
        
        # Verify the update
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        users = users_response.json()
        updated_user = next((u for u in users if u["id"] == test_user_id), None)
        
        if updated_user:
            assert updated_user["role"] == "project_manager"
            print(f"User role updated to: {updated_user['role']}")
    
    def test_update_user_type(self, admin_token, test_user_id):
        """Test updating user type"""
        if not test_user_id:
            pytest.skip("Test user not created")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update user type to marketing
        response = requests.put(f"{BASE_URL}/api/users/{test_user_id}", 
            headers=headers,
            json={"user_type": "marketing"}
        )
        assert response.status_code == 200
        
        # Verify the update
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        users = users_response.json()
        updated_user = next((u for u in users if u["id"] == test_user_id), None)
        
        if updated_user:
            assert updated_user["user_type"] == "marketing"
            print(f"User type updated to: {updated_user['user_type']}")
    
    def test_delete_user(self, admin_token, test_user_id):
        """Test deleting a user"""
        if not test_user_id:
            pytest.skip("Test user not created")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Delete the test user
        response = requests.delete(f"{BASE_URL}/api/users/{test_user_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify user is deleted
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        users = users_response.json()
        deleted_user = next((u for u in users if u["id"] == test_user_id), None)
        assert deleted_user is None
        print(f"User {test_user_id} deleted successfully")
    
    def test_cannot_delete_self(self, admin_token):
        """Test admin cannot delete their own account"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current admin user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        admin_id = me_response.json()["id"]
        
        # Try to delete self
        response = requests.delete(f"{BASE_URL}/api/users/{admin_id}", headers=headers)
        assert response.status_code == 400
        assert "propio" in response.json()["detail"].lower() or "own" in response.json()["detail"].lower()


class TestRolesTab:
    """Test Roles Tab - View, create, edit, delete roles"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_roles_list(self, admin_token):
        """Test getting list of all roles"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
        assert len(roles) >= 3  # At least 3 default roles
        
        # Verify default roles exist
        role_ids = [r["id"] for r in roles]
        assert "admin" in role_ids
        assert "project_manager" in role_ids
        assert "collaborator" in role_ids
        
        print(f"Found {len(roles)} roles: {role_ids}")
    
    def test_create_new_role(self, admin_token):
        """Test creating a new custom role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        test_role_id = f"TEST_role_{uuid.uuid4().hex[:6]}"
        role_data = {
            "id": test_role_id,
            "name": "Test Supervisor Role",
            "description": "A test role for testing purposes",
            "permissions": ["view", "edit_tasks"]
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/roles", 
            headers=headers, json=role_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "role" in data
        assert data["role"]["id"] == test_role_id
        
        # Verify role was created
        roles_response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        roles = roles_response.json()
        created_role = next((r for r in roles if r["id"] == test_role_id), None)
        assert created_role is not None
        assert created_role["name"] == "Test Supervisor Role"
        
        print(f"Created role: {test_role_id}")
        
        # Cleanup - delete the test role
        requests.delete(f"{BASE_URL}/api/admin/roles/{test_role_id}", headers=headers)
    
    def test_edit_role(self, admin_token):
        """Test editing an existing role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a role to edit
        test_role_id = f"TEST_edit_{uuid.uuid4().hex[:6]}"
        requests.post(f"{BASE_URL}/api/admin/roles", headers=headers, json={
            "id": test_role_id,
            "name": "Original Name",
            "description": "Original description",
            "permissions": []
        })
        
        # Edit the role
        response = requests.put(f"{BASE_URL}/api/admin/roles/{test_role_id}", 
            headers=headers, json={
                "id": test_role_id,
                "name": "Updated Name",
                "description": "Updated description",
                "permissions": ["view", "edit"]
            })
        
        assert response.status_code == 200
        
        # Verify update
        roles_response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        roles = roles_response.json()
        updated_role = next((r for r in roles if r["id"] == test_role_id), None)
        assert updated_role is not None
        assert updated_role["name"] == "Updated Name"
        assert updated_role["description"] == "Updated description"
        
        print(f"Role {test_role_id} updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/roles/{test_role_id}", headers=headers)
    
    def test_delete_custom_role(self, admin_token):
        """Test deleting a custom role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a role to delete
        test_role_id = f"TEST_del_{uuid.uuid4().hex[:6]}"
        requests.post(f"{BASE_URL}/api/admin/roles", headers=headers, json={
            "id": test_role_id,
            "name": "Role To Delete",
            "description": "Will be deleted",
            "permissions": []
        })
        
        # Delete the role
        response = requests.delete(f"{BASE_URL}/api/admin/roles/{test_role_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        roles_response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        roles = roles_response.json()
        deleted_role = next((r for r in roles if r["id"] == test_role_id), None)
        assert deleted_role is None
        
        print(f"Role {test_role_id} deleted successfully")
    
    def test_cannot_delete_system_roles(self, admin_token):
        """Test that system roles cannot be deleted"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        system_roles = ["admin", "project_manager", "collaborator"]
        
        for role_id in system_roles:
            response = requests.delete(f"{BASE_URL}/api/admin/roles/{role_id}", headers=headers)
            assert response.status_code == 400
            assert "sistema" in response.json()["detail"].lower() or "system" in response.json()["detail"].lower()
            print(f"System role '{role_id}' correctly protected from deletion")


class TestUserTypesTab:
    """Test User Types Tab - View, create, edit, delete user types"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_user_types_list(self, admin_token):
        """Test getting list of all user types"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/user-types", headers=headers)
        
        assert response.status_code == 200
        user_types = response.json()
        assert isinstance(user_types, list)
        assert len(user_types) >= 8  # At least 8 default types
        
        # Verify structure
        for ut in user_types:
            assert "id" in ut
            assert "name" in ut
            assert "color" in ut
        
        print(f"Found {len(user_types)} user types")
    
    def test_create_new_user_type(self, admin_token):
        """Test creating a new user type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        test_type_id = f"TEST_type_{uuid.uuid4().hex[:6]}"
        type_data = {
            "id": test_type_id,
            "name": "Test Department",
            "color": "emerald"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/user-types", 
            headers=headers, json=type_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "user_type" in data
        assert data["user_type"]["id"] == test_type_id
        
        # Verify creation
        types_response = requests.get(f"{BASE_URL}/api/admin/user-types", headers=headers)
        types = types_response.json()
        created_type = next((t for t in types if t["id"] == test_type_id), None)
        assert created_type is not None
        assert created_type["name"] == "Test Department"
        assert created_type["color"] == "emerald"
        
        print(f"Created user type: {test_type_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/user-types/{test_type_id}", headers=headers)
    
    def test_edit_user_type(self, admin_token):
        """Test editing an existing user type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a type to edit
        test_type_id = f"TEST_edit_{uuid.uuid4().hex[:6]}"
        requests.post(f"{BASE_URL}/api/admin/user-types", headers=headers, json={
            "id": test_type_id,
            "name": "Original Type",
            "color": "slate"
        })
        
        # Edit the type
        response = requests.put(f"{BASE_URL}/api/admin/user-types/{test_type_id}", 
            headers=headers, json={
                "id": test_type_id,
                "name": "Updated Type Name",
                "color": "purple"
            })
        
        assert response.status_code == 200
        
        # Verify update
        types_response = requests.get(f"{BASE_URL}/api/admin/user-types", headers=headers)
        types = types_response.json()
        updated_type = next((t for t in types if t["id"] == test_type_id), None)
        assert updated_type is not None
        assert updated_type["name"] == "Updated Type Name"
        assert updated_type["color"] == "purple"
        
        print(f"User type {test_type_id} updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/user-types/{test_type_id}", headers=headers)
    
    def test_delete_user_type(self, admin_token):
        """Test deleting a user type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a type to delete
        test_type_id = f"TEST_del_{uuid.uuid4().hex[:6]}"
        requests.post(f"{BASE_URL}/api/admin/user-types", headers=headers, json={
            "id": test_type_id,
            "name": "Type To Delete",
            "color": "red"
        })
        
        # Delete the type
        response = requests.delete(f"{BASE_URL}/api/admin/user-types/{test_type_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        types_response = requests.get(f"{BASE_URL}/api/admin/user-types", headers=headers)
        types = types_response.json()
        deleted_type = next((t for t in types if t["id"] == test_type_id), None)
        assert deleted_type is None
        
        print(f"User type {test_type_id} deleted successfully")


class TestModulesTab:
    """Test Modules Tab - View, create, edit, delete modules and task templates"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_modules_list(self, admin_token):
        """Test getting list of all modules with task count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        
        assert response.status_code == 200
        modules = response.json()
        assert isinstance(modules, list)
        assert len(modules) >= 7  # At least 7 default modules
        
        # Verify structure and task count
        for module in modules:
            assert "id" in module
            assert "name" in module
            assert "tasks" in module
            task_count = len(module.get("tasks", []))
            print(f"Module '{module['name']}': {task_count} tasks")
        
        print(f"Found {len(modules)} modules")
    
    def test_create_new_module(self, admin_token):
        """Test creating a new module"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        module_data = {
            "name": f"TEST Module {uuid.uuid4().hex[:6]}",
            "description": "A test module for testing",
            "icon": "Package",
            "color": "blue"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/modules", 
            headers=headers, json=module_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "module" in data
        
        module_id = data["module"]["id"]
        assert data["module"]["name"] == module_data["name"]
        assert data["module"]["tasks"] == []  # New module has no tasks
        
        print(f"Created module: {module_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)
    
    def test_edit_module(self, admin_token):
        """Test editing an existing module"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a module to edit
        create_response = requests.post(f"{BASE_URL}/api/admin/modules", headers=headers, json={
            "name": f"TEST Edit Module {uuid.uuid4().hex[:6]}",
            "description": "Original description",
            "icon": "Package",
            "color": "slate"
        })
        module_id = create_response.json()["module"]["id"]
        
        # Edit the module
        response = requests.put(f"{BASE_URL}/api/admin/modules/{module_id}", 
            headers=headers, json={
                "name": "Updated Module Name",
                "description": "Updated description",
                "color": "emerald"
            })
        
        assert response.status_code == 200
        
        # Verify update
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        updated_module = next((m for m in modules if m["id"] == module_id), None)
        assert updated_module is not None
        assert updated_module["name"] == "Updated Module Name"
        assert updated_module["description"] == "Updated description"
        assert updated_module["color"] == "emerald"
        
        print(f"Module {module_id} updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)
    
    def test_delete_module(self, admin_token):
        """Test deleting a module"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a module to delete
        create_response = requests.post(f"{BASE_URL}/api/admin/modules", headers=headers, json={
            "name": f"TEST Delete Module {uuid.uuid4().hex[:6]}",
            "description": "Will be deleted",
            "icon": "Package",
            "color": "red"
        })
        module_id = create_response.json()["module"]["id"]
        
        # Delete the module
        response = requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        deleted_module = next((m for m in modules if m["id"] == module_id), None)
        assert deleted_module is None
        
        print(f"Module {module_id} deleted successfully")


class TestTaskTemplates:
    """Test Task Templates within Modules - Add, edit, delete task templates"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_module_id(self, admin_token):
        """Create a test module for task template tests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/modules", headers=headers, json={
            "name": f"TEST Task Template Module {uuid.uuid4().hex[:6]}",
            "description": "Module for task template testing",
            "icon": "Package",
            "color": "cyan"
        })
        module_id = response.json()["module"]["id"]
        yield module_id
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/modules/{module_id}", headers=headers)
    
    def test_add_task_template(self, admin_token, test_module_id):
        """Test adding a task template to a module"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        task_data = {
            "title": "Test Task Template",
            "description": "A test task template",
            "assigned_user_type": "desarrollo",
            "checklist": [
                {"text": "Step 1", "completed": False},
                {"text": "Step 2", "completed": False}
            ],
            "deliverables": [
                {"name": "Deliverable 1"},
                {"name": "Deliverable 2"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/modules/{test_module_id}/tasks", 
            headers=headers, json=task_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "task" in data
        assert data["task"]["title"] == "Test Task Template"
        assert "id" in data["task"]
        
        task_id = data["task"]["id"]
        print(f"Created task template: {task_id}")
        
        # Verify task was added to module
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        module = next((m for m in modules if m["id"] == test_module_id), None)
        assert module is not None
        assert len(module["tasks"]) == 1
        assert module["tasks"][0]["title"] == "Test Task Template"
        
        return task_id
    
    def test_edit_task_template(self, admin_token, test_module_id):
        """Test editing a task template"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a task
        create_response = requests.post(f"{BASE_URL}/api/admin/modules/{test_module_id}/tasks", 
            headers=headers, json={
                "title": "Task To Edit",
                "description": "Original description",
                "assigned_user_type": "comercial",
                "checklist": [],
                "deliverables": []
            })
        task_id = create_response.json()["task"]["id"]
        
        # Edit the task
        response = requests.put(f"{BASE_URL}/api/admin/modules/{test_module_id}/tasks/{task_id}", 
            headers=headers, json={
                "title": "Updated Task Title",
                "description": "Updated description",
                "assigned_user_type": "marketing"
            })
        
        assert response.status_code == 200
        
        # Verify update
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        module = next((m for m in modules if m["id"] == test_module_id), None)
        updated_task = next((t for t in module["tasks"] if t.get("id") == task_id), None)
        
        assert updated_task is not None
        assert updated_task["title"] == "Updated Task Title"
        assert updated_task["description"] == "Updated description"
        assert updated_task["assigned_user_type"] == "marketing"
        
        print(f"Task template {task_id} updated successfully")
    
    def test_delete_task_template(self, admin_token, test_module_id):
        """Test deleting a task template"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create a task
        create_response = requests.post(f"{BASE_URL}/api/admin/modules/{test_module_id}/tasks", 
            headers=headers, json={
                "title": "Task To Delete",
                "description": "Will be deleted",
                "assigned_user_type": None,
                "checklist": [],
                "deliverables": []
            })
        task_id = create_response.json()["task"]["id"]
        
        # Get initial task count
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        module = next((m for m in modules if m["id"] == test_module_id), None)
        initial_count = len(module["tasks"])
        
        # Delete the task
        response = requests.delete(f"{BASE_URL}/api/admin/modules/{test_module_id}/tasks/{task_id}", 
            headers=headers)
        assert response.status_code == 200
        
        # Verify deletion
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        module = next((m for m in modules if m["id"] == test_module_id), None)
        
        assert len(module["tasks"]) == initial_count - 1
        deleted_task = next((t for t in module["tasks"] if t.get("id") == task_id), None)
        assert deleted_task is None
        
        print(f"Task template {task_id} deleted successfully")


class TestProjectCreationWithModules:
    """Test project creation generates tasks from DB templates"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_project_creation_generates_tasks(self, admin_token):
        """Test that creating a project generates tasks from module templates"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get available modules
        modules_response = requests.get(f"{BASE_URL}/api/admin/modules", headers=headers)
        modules = modules_response.json()
        
        # Select first 2 modules with tasks
        selected_modules = [m["id"] for m in modules if len(m.get("tasks", [])) > 0][:2]
        
        if len(selected_modules) < 2:
            pytest.skip("Not enough modules with tasks")
        
        # Calculate expected task count
        expected_tasks = sum(
            len(m.get("tasks", [])) 
            for m in modules 
            if m["id"] in selected_modules
        )
        
        # Create a project
        project_data = {
            "name": f"TEST Project {uuid.uuid4().hex[:6]}",
            "client_name": "Test Client",
            "start_date": "2026-01-15",
            "end_date": "2026-06-15",
            "modules": selected_modules,
            "description": "Test project for task generation"
        }
        
        response = requests.post(f"{BASE_URL}/api/projects", 
            headers=headers, json=project_data)
        
        assert response.status_code == 200
        data = response.json()
        project = data.get("project", data)  # Handle both nested and flat response
        project_id = project["id"]
        
        # Get project tasks
        tasks_response = requests.get(f"{BASE_URL}/api/projects/{project_id}/tasks", headers=headers)
        assert tasks_response.status_code == 200
        tasks = tasks_response.json()
        
        # Verify tasks were generated
        assert len(tasks) == expected_tasks, f"Expected {expected_tasks} tasks, got {len(tasks)}"
        
        # Verify task structure
        for task in tasks:
            assert "id" in task
            assert "title" in task
            assert "module_id" in task
            assert task["module_id"] in selected_modules
            assert "checklist" in task
            assert "deliverables" in task
        
        print(f"Project created with {len(tasks)} tasks from {len(selected_modules)} modules")
        
        # Cleanup - delete the project
        requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
