const { writeFileSync } = require('node:fs') as typeof import('node:fs');
const { join } = require('node:path') as typeof import('node:path');

const transferUrl = 'http://localhost:3000/transactions/transfer';
const PARALLEL_REQUESTS = 100;
const runId = Date.now();
const VERBOSE = process.env.CONCURRENCY_VERBOSE === '1' || process.env.CONCURRENCY_VERBOSE === 'true';

type HttpResult = {
  index: number;
  status: number;
  ok: boolean;
  body: unknown;
};

async function transferRequest(index: number): Promise<HttpResult> {
  const res = await fetch(transferUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'idempotency-key': `key-${runId}-${index}`,
      'x-correlation-id': `corr-${index}`,
    },
    body: JSON.stringify({
      transaction: {
        id: `tx-${index}`,
        amount: 100,
        currency: 'COP',
        description: 'test concurrency',
        receiver: {
          document: '123',
          documentType: 'CC',
          name: 'Test User',
          account: '123456',
          accountType: 'SAVINGS',
        },
      },
    }),
  });
  const body = await res.json().catch(() => ({ parseError: true, raw: 'non-json body' }));
  return {
    index,
    status: res.status,
    ok: res.ok,
    body,
  };
}

async function run() {
  const results = await Promise.allSettled(
    Array.from({ length: PARALLEL_REQUESTS }, (_, i) => transferRequest(i)),
  );

  const byHttpStatus = new Map<number, number>();
  let networkErrors = 0;

  for (const r of results) {
    if (r.status === 'rejected') {
      networkErrors += 1;
      continue;
    }
    const v = r.value;
    byHttpStatus.set(v.status, (byHttpStatus.get(v.status) ?? 0) + 1);
  }

  const outPath = join(process.cwd(), 'scripts', `concurrency-output-${runId}.json`);
  const payload = {
    meta: {
      runId,
      parallelRequests: PARALLEL_REQUESTS,
      transferUrl,
      summary: Object.fromEntries(byHttpStatus),
      networkErrors,
    },
    results,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log('🔥 Test de concurrencia terminado');
  console.log(`Lanzadas en paralelo: ${PARALLEL_REQUESTS} (runId=${runId})`);
  console.log('Resumen HTTP:', Object.fromEntries(byHttpStatus));

  if (VERBOSE) {
    console.log('Detalle (Promise.allSettled):');
    console.dir(results, { depth: 4 });
  }
}

run();
