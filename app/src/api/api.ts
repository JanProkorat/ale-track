export const API_BASE_URL = (() => {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) {
    const msg = 'Missing environment variable VITE_API_BASE_URL. Check .env file (.env.example).';
    console.error(msg);
    throw new Error(msg);
  }
  return url.replace(/\/$/, '');
})();

