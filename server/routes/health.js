function registerHealthRoute(app) {
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });
}

module.exports = {
  registerHealthRoute
};
