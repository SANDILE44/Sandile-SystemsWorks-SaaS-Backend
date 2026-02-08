export async function sendAlertEmail({ to, subject, text }) {
  // Phase 1: simulate email until provider is added
  console.log('=== EMAIL ALERT (SIMULATED) ===');
  console.log('TO:', to);
  console.log('SUBJECT:', subject);
  console.log(text);
  console.log('=== END EMAIL ===');
  return true;
}
