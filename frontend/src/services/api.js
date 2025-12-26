import axios from 'axios';

// Dynamically construct API URL based on deployment mode
// This allows the app to work in both development and Docker/Podman environments
const getApiBaseUrl = () => {
    // Check if we're in development mode (Vite dev server)
    // import.meta.env.DEV is true when running 'npm run dev'
    const isDevMode = import.meta.env.DEV;

    if (isDevMode) {
        // Development: npm run dev - connect directly to backend on port 8002
        // Use dynamic hostname to support network access (e.g., 192.168.0.111:5174)
        const hostname = window.location.hostname;
        return `http://${hostname}:8002/api`;
    } else {
        // Production: Docker/Podman with nginx - use relative path
        // Nginx will proxy /api requests to the backend container
        return '/api';
    }
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
});

export const getPortfolio = (type) => api.get('/portfolio', { params: { type } });
export const getInvestments = (type, activeOnly = false) => api.get('/investments', { params: { type, active_only: activeOnly } });
export const addInvestment = (data) => api.post('/investments', data);
export const deleteInvestment = (id) => api.delete(`/investments/${id}`);
export const updateInvestment = (id, data) => api.put(`/investments/${id}`, data);
export const getWatchlist = () => api.get('/watchlist');
export const addToWatchlist = (data) => api.post('/watchlist', data);
export const getWatchlistGroups = () => api.get('/watchlist/groups');
export const createWatchlistGroup = (name) => api.post('/watchlist/groups', { name });
export const updateWatchlistGroup = (id, name) => api.put(`/watchlist/groups/${id}`, { name });
export const deleteWatchlistGroup = (id) => api.delete(`/watchlist/groups/${id}`);
export const syncNav = () => api.post('/sync-nav');
export const searchSchemes = (query) => api.get('/schemes/search', { params: { query, limit: 50 } });
export const getAMCs = () => api.get('/schemes/amc');
export const getSchemesByAMC = (amc) => api.get('/schemes', { params: { amc } });
export const getSyncStatus = () => api.get('/sync-status');
export const getSchemeByCode = (code) => api.get(`/schemes/code/${code}`);
// Account Management
export const getAccounts = () => api.get('/accounts');
export const addAccount = (name) => api.post('/accounts', { name });
export const updateAccount = (id, name) => api.put(`/accounts/${id}`, { name });
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);

export const deleteWatchlistItem = (id) => api.delete(`/watchlist/item/${id}`);
export const markWatchlistItemSold = (id, data) => api.post(`/watchlist/item/${id}/sell`, data);
export const updateWatchlistDate = (id, date) => api.patch(`/watchlist/item/${id}/date`, { date });
export const redeemInvestment = (data) => api.post('/redeem', data);
export const deleteScheme = (schemeCode) => api.delete(`/portfolio/scheme/${schemeCode}`);

// SIP Mandates
export const getSipMandates = (activeOnly = true) => api.get('/sips/mandates', { params: { active_only: activeOnly } });
export const createSipMandate = (data) => api.post('/sips/mandates', data);
export const updateSipMandate = (id, data) => api.put(`/sips/mandates/${id}`, data);
export const deleteSipMandate = (id) => api.delete(`/sips/mandates/${id}`);

export default api;
