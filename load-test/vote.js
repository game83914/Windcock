// k6 load test for the voting endpoint.
// Prep: create a voting topic + enough test user tokens.
// Run:  k6 run -e API=http://localhost:3000/api/v1 -e TOPIC=<id> -e OPTION=<id> load-test/vote.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API || 'http://localhost:3000/api/v1';
const TOPIC = __ENV.TOPIC || '1';
const OPTION = __ENV.OPTION || '1';

// Each VU needs its own unique phone number + OTP to get a distinct token.
// For MVP sanity testing, seed N OTP-redeemed tokens in a file and read them here.
function authTokenFor(iter) {
  // Replace with a real token provider (e.g., generated test tokens) for a
  // meaningful duplicate-prevention test. Keeping single-token here only
  // exercises the 409 conflict path.
  return 'TEST_TOKEN_PLACEHOLDER';
}

export const options = {
  scenarios: {
    vote: {
      executor: 'constant-vus',
      vus: __ENV.VUS || 50,
      duration: '30s',
      exec: 'vote',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function vote() {
  const token = authTokenFor(__ITER);
  const res = http.post(
    `${API}/topics/${TOPIC}/vote`,
    JSON.stringify({ optionId: Number(OPTION) }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const ok = res.status === 200 || res.status === 201;
  const dup = res.status === 409;
  check(res, {
    'voted ok': () => ok,
    'duplicate handled gracefully': () => dup,
    'not a 5xx': (r) => r.status < 500,
  });
  sleep(0.1);
}