import axios from 'axios'
import { API_BASE_URL } from '../config.js'

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000
})

import { globalLoadingEvents } from '../context/LoadingContext.jsx'

export function getDeviceId() {
    let id = localStorage.getItem('wa_dashboard_device_id')
    if (!id) {
        id = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
        localStorage.setItem('wa_dashboard_device_id', id)
    }
    return id
}

// Request interceptor to automatically attach JWT token and trigger loader on user actions
api.interceptors.request.use(
    (config) => {
        const method = (config.method || 'get').toLowerCase()
        const isUserAction = ['post', 'put', 'patch', 'delete'].includes(method)

        // Trigger global loader when:
        // 1. Explicitly requested via config.showGlobalLoader, OR
        // 2. User submits an action (POST, PUT, PATCH, DELETE) and request is not silent
        // Background GET requests/intervals do NOT trigger the loader automatically!
        if (!config.silent && (config.showGlobalLoader || isUserAction)) {
            const loaderText = typeof config.showGlobalLoader === 'string'
                ? config.showGlobalLoader
                : (config.loadingText || (config.url?.includes('/login') ? 'Signing in...' : 'Processing...'))
            globalLoadingEvents.start(loaderText)
        }

        const token = localStorage.getItem('wa_dashboard_token')
        const activeAccountId = localStorage.getItem('active_wa_account_id')
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`
        }
        if (activeAccountId) {
            config.headers['X-Account-ID'] = activeAccountId
        }
        config.headers['X-Device-ID'] = getDeviceId()
        return config
    },
    (error) => {
        globalLoadingEvents.stop()
        return Promise.reject(error);
    }
)

// Response interceptor to handle expired tokens, stop global loader, and access revocation
api.interceptors.response.use(
    (response) => {
        globalLoadingEvents.stop()
        return response
    },
    (error) => {
        globalLoadingEvents.stop()
        const status = error.response ? error.response.status : null;
        const data = error.response ? error.response.data : {};
        const isRevoked = data?.code === 'ACCESS_REVOKED' || data?.code === 'USER_DISABLED' || data?.code === 'SESSION_REVOKED';

        if (status === 401 || (status === 403 && isRevoked)) {
            console.warn(`[API] Access revoked or unauthorized request (${status} - ${data?.code || 'UNAUTHORIZED'}). Clearing session...`);
            localStorage.removeItem('wa_dashboard_token');
            localStorage.removeItem('wa_dashboard_user');
            
            if (isRevoked && data?.message) {
                sessionStorage.setItem('access_revoked_message', data.message);
            }

            if (window.location.pathname !== '/login') {
                window.location.href = '/login?revoked=true';
            }
        } else if (status === 403 && data?.code === 'PERMISSION_DENIED') {
            console.warn(`[API] Permission denied for action/page:`, data.message);
            if (window.location.pathname !== '/dashboard' && !window.location.pathname.startsWith('/login')) {
                alert(data.message || 'Your access to this feature has been removed by the administrator.');
                window.location.href = '/dashboard';
            }
        }
        return Promise.reject(error)
    }
)

export default api
