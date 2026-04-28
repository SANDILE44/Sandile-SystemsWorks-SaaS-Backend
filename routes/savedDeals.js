(() => {

const $ = id => document.getElementById(id);

/* ================= API ================= */
async function api(url, method = "GET", body = null) {
  const token = localStorage.getItem("token");
  if (!token) return location.replace("login.html");

  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : null
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      return location.replace("login.html");
    }

    return await res.json();

  } catch (err) {
    console.error("SavedDeals API error:", err);
    return null;
  }
}

/* ================= SAVE CURRENT DEAL ================= */
async function saveDeal(calculatorType, data) {

  // minimal universal payload
  const payload = {
    type: calculatorType,   // "restaurant", "construction", etc
    inputs: data.inputs,
    results: data.results
  };

  return await api("/api/saved-deals", "POST", payload);
}

/* ================= LOAD SAVED DEALS ================= */
async function loadDeals() {
  return await api("/api/saved-deals");
}

/* ================= RENDER DEALS ================= */
function renderDeals(deals) {

  const container = $("savedDealsContainer");
  if (!container) return;

  if (!deals || !deals.length) {
    container.innerHTML = "<p>No saved deals yet.</p>";
    return;
  }

  container.innerHTML = deals.map(d => `
    <div class="deal-card">
      <div class="deal-title">
        ${d.type.toUpperCase()} - ${new Date(d.createdAt).toLocaleDateString()}
      </div>

      <div class="deal-body">
        <div><strong>Profit:</strong> ${d.results?.profit ?? 0}</div>
        <div><strong>Revenue:</strong> ${d.results?.monthlyRevenue ?? 0}</div>
        <div><strong>Margin:</strong> ${d.results?.margin ?? 0}%</div>
      </div>

      <button onclick="deleteDeal('${d._id}')">
        Delete
      </button>
    </div>
  `).join("");
}

/* ================= DELETE DEAL ================= */
async function deleteDeal(id) {
  await api(`/api/saved-deals/${id}`, "DELETE");
  initSavedDeals(); // refresh
}

/* ================= INIT ================= */
async function initSavedDeals() {
  const deals = await loadDeals();
  renderDeals(deals);
}

/* ================= EXPORT ================= */
window.SavedDeals = {
  saveDeal,
  initSavedDeals,
  deleteDeal
};

})();