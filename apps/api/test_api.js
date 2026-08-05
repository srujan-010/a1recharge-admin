const axios = require('axios');

const api = axios.create();

api.interceptors.request.use(
  (config) => {
    throw new Error('Test Error');
  }
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error('[API Error]:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

api.post('http://example.com').catch(() => {});
