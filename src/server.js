const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { URL } = require('url');

loadEnvFile();

const PORT = process.env.PORT || 5173;
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 400);
const SHEET_ID = process.env.SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = resolvePrivateKey();

const publicDir = path.join(__dirname, '..', 'public');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/config') {
    return jsonResponse(res, 200, { deliveryFee: DELIVERY_FEE });
  }

  if (req.method === 'POST' && url.pathname === '/api/orders') {
    try {
      const body = await readJsonBody(req);
      const validationError = validateOrder(body);
      if (validationError) {
        return jsonResponse(res, 400, { error: validationError });
      }

      const itemsTotal = body.items.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0
      );
      const total = itemsTotal + DELIVERY_FEE;
      const booksSummary = body.items
        .map((item) => `${item.title} x${item.quantity}`)
        .join('; ');
      const now = new Date();

      if (canUseSheets()) {
        await appendToSheet([
          body.firstName,
          body.lastName,
          body.phone,
          body.wilaya,
          body.deliveryMode,
          booksSummary,
          total,
          new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'Africa/Algiers',
          }).format(now),
          'Nouveau',
        ]);
      } else {
        console.warn('Google Sheets non configuré, commande non archivée.');
      }

      return jsonResponse(res, 201, {
        message: 'Commande reçue',
        total,
        status: canUseSheets() ? 'archived' : 'pending',
      });
    } catch (error) {
      console.error('Erreur lors de la création de commande:', error);
      return jsonResponse(res, 500, { error: 'Erreur serveur' });
    }
  }

  if (req.method === 'GET') {
    return serveStaticFile(res, url.pathname);
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`BookZZ server sur http://localhost:${PORT}`);
});

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
      }
    });
}

function resolvePrivateKey() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
    const decoded = Buffer.from(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64,
      'base64'
    ).toString('utf-8');
    return decoded;
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(
      /\\n/g,
      '\n'
    );
  }

  return undefined;
}

function canUseSheets() {
  return Boolean(SHEET_ID && SERVICE_ACCOUNT_EMAIL && SERVICE_ACCOUNT_PRIVATE_KEY);
}

function serveStaticFile(res, requestPath) {
  const sanitizedPath = path
    .normalize(requestPath)
    .replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(publicDir, sanitizedPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(publicDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
  }[ext] || 'text/plain';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload trop volumineux'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function validateOrder(body) {
  const requiredText = [
    'firstName',
    'lastName',
    'phone',
    'wilaya',
    'deliveryMode',
  ];
  for (const field of requiredText) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      return `Champ manquant: ${field}`;
    }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'Aucun article dans le panier';
  }

  const invalidItem = body.items.find(
    (item) =>
      !item.title ||
      typeof item.price !== 'number' ||
      typeof item.quantity !== 'number' ||
      item.quantity <= 0
  );
  if (invalidItem) {
    return 'Articles invalides';
  }

  return null;
}

async function appendToSheet(row) {
  const jwt = buildJwt();

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Token Google Sheets échoué: ${text}`);
  }

  const { access_token: accessToken } = await tokenResponse.json();
  const sheetRange = 'Feuille1!A:I';
  const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
    sheetRange
  )}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(sheetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      majorDimension: 'ROWS',
      values: [row],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Échec d'écriture Sheets: ${text}`);
  }
}

function buildJwt() {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(SERVICE_ACCOUNT_PRIVATE_KEY, 'base64');
  return `${toSign}.${base64Url(signature)}`;
}

function base64UrlEncode(value) {
  return base64Url(Buffer.from(value).toString('base64'));
}

function base64Url(str) {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
