import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/v1';

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Attempt token refresh on 401, but only once and not on auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        if (data.accessToken) {
          localStorage.setItem('skillforge_token', data.accessToken);
          window.dispatchEvent(new CustomEvent('token_refreshed', { detail: data.accessToken }));
          // If the failed request used an Authorization header, update it
          if (originalRequest.headers?.Authorization) {
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          }
          // Re-fire the original request
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token is expired or invalid, log the user out
        localStorage.removeItem('skillforge_user');
        localStorage.removeItem('skillforge_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
