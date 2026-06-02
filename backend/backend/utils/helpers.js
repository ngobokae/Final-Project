export const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
};

export const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

export const sendError = (res, statusCode, message) => {
  sendJSON(res, statusCode, { error: message });
};

export const sendSuccess = (res, data, statusCode = 200) => {
  sendJSON(res, statusCode, data);
};

export const parseQuery = (url) => {
  const queryParams = {};
  try {
    // Handle both full URLs and pathnames
    let urlString = url;
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = `http://localhost${urlString}`;
    }
    const urlObj = new URL(urlString);
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
  } catch (error) {
    // If URL parsing fails, try manual parsing
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) {
          queryParams[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
      });
    }
  }
  return queryParams;
};
