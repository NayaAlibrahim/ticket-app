const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) =>
    req.user && req.user.role === role ? next() : res.status(403).json({ error: 'Forbidden' });
}

module.exports = { requireAuth, requireRole };