const { app } = require('@azure/functions');
const fs = require('fs');
const os = require('os');
const path = require('path');
const YEAR_MONTH_RE = /^\d{4}$|^([1-9]|1[0-2])$/;

function decodeCerts() {
  const certB64 = process.env.AFIP_CERT_B64;
  const keyB64 = process.env.AFIP_KEY_B64;

  if (!certB64 || !keyB64) return null;

  const tmpDir = os.tmpdir();
  const certPath = path.join(tmpDir, `afip_cert_${process.pid}.crt`);
  const keyPath = path.join(tmpDir, `afip_key_${process.pid}.key`);

  fs.writeFileSync(certPath, Buffer.from(certB64, 'base64'));
  fs.writeFileSync(keyPath, Buffer.from(keyB64, 'base64'));

  return { certPath, keyPath };
}

function cleanupCerts(paths) {
  if (!paths) return;
  try { fs.unlinkSync(paths.certPath); } catch (_) {}
  try { fs.unlinkSync(paths.keyPath); } catch (_) {}
}

app.http('processMonth', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'process-month',
  handler: async (request, context) => {
    let certPaths = null;

    try {
      const body = await request.json();
      const year = parseInt(body?.year);
      const month = parseInt(body?.month);

      if (!year || year < 2000 || year > 2100) {
        return { status: 400, jsonBody: { error: 'year must be a valid 4-digit number' } };
      }
      if (!month || month < 1 || month > 12) {
        return { status: 400, jsonBody: { error: 'month must be between 1 and 12' } };
      }

      // Reconstruct AFIP certs from base64 env vars
      certPaths = decodeCerts();
      if (certPaths) {
        process.env.AFIP_CERT_PATH = certPaths.certPath;
        process.env.AFIP_KEY_PATH = certPaths.keyPath;
      }

      // Use case is required here (not at module load) so cert paths are set first
      const container = require('../application/di/container');
      await container.initialize();

      try {
        const useCase = container.getProcessMonthOrdersUseCase();
        const result = await useCase.execute({ year, month });

        return {
          jsonBody: { generated_at: new Date().toISOString(), ...result },
          headers: { 'Cache-Control': 'no-store' },
        };
      } finally {
        await container.cleanup();
        container.reset();
      }

    } catch (error) {
      context.error('process-month failed:', error.message);
      return { status: 500, jsonBody: { error: error.message } };
    } finally {
      cleanupCerts(certPaths);
    }
  },
});
