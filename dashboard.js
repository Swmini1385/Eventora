/**
 * Eventora Dashboard Logic
 * Handles Event management and UI synchronization
 */

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboardData();
    lucide.createIcons();
});

// ---------------------------------------------------------
// REUSABLE JSONP FETCH HELPER (Solving CORS for GAS)
// ---------------------------------------------------------
function fetchJSONP(url, callbackName) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const name = callbackName || `jsonp_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        
        window[name] = (data) => {
            cleanup();
            resolve(data);
        };

        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP request failed'));
        };

        const connector = url.includes('?') ? '&' : '?';
        script.src = `${url}${connector}callback=${name}`;
        document.body.appendChild(script);

        function cleanup() {
            delete window[name];
            if (script.parentNode) document.body.removeChild(script);
        }
        
        setTimeout(() => {
            if (window[name]) {
                cleanup();
                reject(new Error('JSONP request timeout'));
            }
        }, 15000);
    });
}

// Authentication check
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('eventora_user'));
    if (!user) {
        window.location.href = 'auth.html?mode=login';
        return;
    }
    document.getElementById('welcome-msg').innerText = `Hello, ${user.name}!`;
}

// Logout
function logout() {
    localStorage.removeItem('eventora_user');
    window.location.href = 'index.html';
}

// Modal handling
function showCreateModal() {
    document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

// Data loading (Backend-driven)
async function loadDashboardData() {
    const user = JSON.parse(localStorage.getItem('eventora_user'));
    if (!user) return;

    const eventsListContainer = document.getElementById('events-list');
    eventsListContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Fetching your events... 🔍</div>`;

    try {
        // Step 1: Ensure we have the folderId. Using JSONP for compatibility
        // Step 1: Ensure we have the folderId from the cloud (Session Resume)
        if (!user.folderId) {
            try {
                const data = await fetchJSONP(`${API_URL}?action=get_profile&identifier=${user.identifier}`);
                if (data.success && data.user.folderId) {
                    user.folderId = data.user.folderId;
                    user.name = data.user.name;
                    localStorage.setItem('eventora_user', JSON.stringify(user));
                    document.getElementById('welcome-msg').innerText = `Hello, ${user.name}!`;
                }
            } catch (e) {
                console.warn("Profile sync failed:", e);
            }
        }

        // Step 2: Fetch actual events from the user's folder using JSONP
        const data = await fetchJSONP(`${API_URL}?action=list_events&folderId=${user.folderId}`);

        if (data.success) {
            renderEvents(data.events);
            updateStats(data.events);
            localStorage.setItem('eventora_events_' + user.identifier, JSON.stringify(data.events));
        } else {
            throw new Error(data.message || "Failed to load events");
        }
    } catch (err) {
        console.warn("Cloud sync error, falling back to local:", err);
        const events = JSON.parse(localStorage.getItem('eventora_events_' + user.identifier) || '[]');
        renderEvents(events);
        updateStats(events);
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-list');
    if (events.length === 0) {
        container.innerHTML = `
            <div class="glass" style="padding: 3rem; text-align: center; border-style: dashed; background: transparent;">
                <p style="color: var(--text-muted);">No events created yet. Start by creating one!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = events.map(event => `
        <div class="glass glass-hover event-card" style="margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 1.5rem;">
                <div style="background: rgba(99, 102, 241, 0.1); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: 0.75rem; color: var(--primary);">
                    <i data-lucide="calendar"></i>
                </div>
                <div>
                    <h4 style="font-size: 1.1rem; font-weight: 700;">${event.name}</h4>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">Date: ${event.date} | Fee: ₹${event.fee}</p>
                </div>
            </div>
            <div style="display: flex; gap: 0.75rem;">
                <button class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="viewEvent('${event.id}')">Manage</button>
                <button class="btn btn-outline" style="padding: 0.5rem; color: var(--primary);" onclick="editEvent('${event.id}')"><i data-lucide="pencil" size="18"></i></button>
                <button class="btn btn-outline" style="padding: 0.5rem; color: #f87171;" onclick="deleteEvent('${event.id}')"><i data-lucide="trash-2" size="18"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function updateStats(events) {
    document.getElementById('total-events-stat').innerText = events.length;
    // Mocking other stats for now
    document.getElementById('total-attendees-stat').innerText = '0';
    document.getElementById('total-earnings-stat').innerText = '₹0';
}

let editModeId = null;

async function editEvent(id) {
    const user = JSON.parse(localStorage.getItem('eventora_user'));
    
    const saveBtn = document.getElementById('save-event-btn');
    saveBtn.innerText = "Loading... ⏳";
    
    try {
        // Fetch fresh metadata from Row 1
        const data = await fetchJSONP(`${API_URL}?action=get_event_info&eventId=${id}`);
        if (data.success) {
            editModeId = id;
            document.getElementById('event-name').value = data.name || '';
            document.getElementById('event-date').value = data.startDate || '';
            document.getElementById('event-end-date').value = data.endDate || '';
            document.getElementById('event-fee').value = data.fee || '100';
            document.getElementById('event-venue').value = data.venue || '';
            document.getElementById('event-wa-link').value = data.wa || '';
            document.getElementById('event-upi-id').value = data.upi || '';
            
            document.querySelector('#createModal h2').innerText = "Edit Event Details";
            document.getElementById('save-event-btn').innerText = "Update Event";
            showCreateModal();
        }
    } catch (e) {
        alert("Could not load event details from the cloud.");
    } finally {
        saveBtn.innerText = "Update Event";
    }
}

const API_URL = "https://script.google.com/macros/s/AKfycbx4xTJrfJwAy8OrLUdSiWTKFy22Qucgnepbp0-61WaS8S8X9IlIpvYeBJLdx9Nwt5lk_Q/exec";

// Event creation/edit logic
async function handleCreateEvent(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-event-btn');
    const originalText = saveBtn.innerText;
    
    saveBtn.disabled = true;
    saveBtn.innerText = "Syncing with Cloud... ⏳";

    const user = JSON.parse(localStorage.getItem('eventora_user'));
    
    // Collect all data
    const eventData = {
        action: 'create_event',
        folderId: user.folderId || '',
        identifier: user.identifier,
        eventId: editModeId || '', // Pass existing ID if editing
        name: document.getElementById('event-name').value,
        startDate: document.getElementById('event-date').value,
        endDate: document.getElementById('event-end-date').value,
        fee: document.getElementById('event-fee').value,
        venue: document.getElementById('event-venue').value,
        wa: document.getElementById('event-wa-link').value,
        upi: document.getElementById('event-upi-id').value
    };

    try {
        const queryParams = new URLSearchParams(eventData);
        const data = await fetchJSONP(`${API_URL}?${queryParams.toString()}`);
        
        if (data.success) {
            alert("✅ " + (data.message || "Event saved successfully!"));
            closeCreateModal();
            loadDashboardData(); // Refresh UI from cloud
            e.target.reset();
            editModeId = null;
        } else {
            alert("❌ Error: " + data.message);
        }
    } catch (err) {
        console.error("Cloud sync error:", err);
        alert("⚠️ Cloud sync failed. Check your internet or API settings.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Create Event";
    }
}

function viewEvent(id) {
    window.location.href = `event-detail.html?id=${id}`;
}

async function deleteEvent(id) {
    if (confirm("Are you sure you want to delete this event across all devices? This will move the Google Sheet to Trash.")) {
        try {
            const data = await fetchJSONP(`${API_URL}?action=delete_event&eventId=${id}`);
            if (data.success) {
                alert("✅ Event deleted successfully!");
                loadDashboardData(); // Refresh UI from cloud
            } else {
                alert("❌ Error: " + data.message);
            }
        } catch (err) {
            console.error("Delete Error:", err);
            alert("⚠️ Cloud sync failed. Delete locally for now?");
            // Fallback
            const user = JSON.parse(localStorage.getItem('eventora_user'));
            let events = JSON.parse(localStorage.getItem('eventora_events_' + user.identifier) || '[]');
            events = events.filter(e => e.id !== id);
            localStorage.setItem('eventora_events_' + user.identifier, JSON.stringify(events));
            loadDashboardData();
        }
    }
}
