// utils/subscription.js
function applyThirtyDaySubscription(user) {
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const currentEnd = user.subscriptionEnd
    ? new Date(user.subscriptionEnd)
    : null;

  // ✅ Extend if still active, otherwise start from now
  const base =
    currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;

  user.subscriptionStart = now;
  user.subscriptionEnd = new Date(base.getTime() + thirtyDaysMs);
  user.hasPaid = true;

  return user;
}

module.exports = { applyThirtyDaySubscription };
