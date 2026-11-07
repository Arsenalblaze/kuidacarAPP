import { apiClient } from '../src/app/utils/api';

async function run() {
  try {
    console.log('Starting inactivity notification job...');
    const res = await apiClient.notifyInactiveUsers(21);
    console.log('Result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Error running notify job:', err);
    process.exit(2);
  }
}

run();
