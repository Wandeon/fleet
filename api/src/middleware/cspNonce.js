export function cspNonce(req, res, next) {
  req.nonce = req.get('X-Nonce') || cryptoRandom();
  res.locals.nonce = req.nonce;
  next();
}
function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

