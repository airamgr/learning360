import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // Auth
  login: (email, password) =>
    axios.post(`${API}/auth/login`, { email, password }),
  register: (data) => axios.post(`${API}/auth/register`, data),
  getMe: () => axios.get(`${API}/auth/me`, { headers: getAuthHeader() }),

  // Users
  getUsers: () => axios.get(`${API}/users`, { headers: getAuthHeader() }),
  updateUser: (userId, data) =>
    axios.put(`${API}/users/${userId}`, data, { headers: getAuthHeader() }),
  deleteUser: (userId) =>
    axios.delete(`${API}/users/${userId}`, { headers: getAuthHeader() }),

  // Projects
  getProjects: () =>
    axios.get(`${API}/projects`, { headers: getAuthHeader() }),
  getProject: (projectId) =>
    axios.get(`${API}/projects/${projectId}`, { headers: getAuthHeader() }),
  createProject: (data) =>
    axios.post(`${API}/projects`, data, { headers: getAuthHeader() }),
  updateProject: (projectId, data) =>
    axios.put(`${API}/projects/${projectId}`, data, {
      headers: getAuthHeader(),
    }),
  deleteProject: (projectId) =>
    axios.delete(`${API}/projects/${projectId}`, { headers: getAuthHeader() }),
  exportProjectPdf: (projectId) =>
    axios.get(`${API}/projects/${projectId}/export-pdf`, {
      headers: getAuthHeader(),
      responseType: "blob",
    }),

  // Tasks
  getProjectTasks: (projectId) =>
    axios.get(`${API}/projects/${projectId}/tasks`, {
      headers: getAuthHeader(),
    }),
  getTask: (taskId) =>
    axios.get(`${API}/tasks/${taskId}`, { headers: getAuthHeader() }),
  updateTask: (taskId, data) =>
    axios.put(`${API}/tasks/${taskId}`, data, { headers: getAuthHeader() }),
  createTask: (projectId, data) =>
    axios.post(`${API}/projects/${projectId}/tasks`, data, {
      headers: getAuthHeader(),
    }),

  // Deliverables
  getProjectDeliverables: (projectId) =>
    axios.get(`${API}/projects/${projectId}/deliverables`, {
      headers: getAuthHeader(),
    }),
  getTaskDeliverables: (taskId) =>
    axios.get(`${API}/tasks/${taskId}/deliverables`, {
      headers: getAuthHeader(),
    }),
  createDeliverable: (taskId, data) =>
    axios.post(`${API}/tasks/${taskId}/deliverables`, data, {
      headers: getAuthHeader(),
    }),
  updateDeliverable: (taskId, deliverableId, data) =>
    axios.put(`${API}/tasks/${taskId}/deliverables/${deliverableId}`, data, {
      headers: getAuthHeader(),
    }),
  uploadDeliverableFile: (taskId, deliverableId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return axios.post(
      `${API}/tasks/${taskId}/deliverables/${deliverableId}/upload`,
      formData,
      {
        headers: {
          ...getAuthHeader(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
  },
  deleteDeliverable: (taskId, deliverableId) =>
    axios.delete(`${API}/tasks/${taskId}/deliverables/${deliverableId}`, {
      headers: getAuthHeader(),
    }),

  // Modules
  getModules: () => axios.get(`${API}/modules`, { headers: getAuthHeader() }),
  
  // User Types
  getUserTypes: () => axios.get(`${API}/user-types`, { headers: getAuthHeader() }),

  // Dashboard
  getDashboardStats: () =>
    axios.get(`${API}/dashboard/stats`, { headers: getAuthHeader() }),

  // Notifications
  getNotifications: () =>
    axios.get(`${API}/notifications`, { headers: getAuthHeader() }),
  markNotificationRead: (notificationId) =>
    axios.put(
      `${API}/notifications/${notificationId}/read`,
      {},
      { headers: getAuthHeader() }
    ),
  markAllNotificationsRead: () =>
    axios.put(`${API}/notifications/read-all`, {}, { headers: getAuthHeader() }),
};

export default api;
