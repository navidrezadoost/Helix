import express from 'express';
import { verifyShopifyToken } from './middleware/shopify-verify';
import { proxyHelixSubmission } from './controllers/helix-proxy';

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Shopify-authenticated Helix submission endpoint
app.post('/api/helix/submit', verifyShopifyToken, proxyHelixSubmission);

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`Shopify Helix Proxy running on port ${PORT}`);
    });
}