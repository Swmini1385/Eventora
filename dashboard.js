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
        if (!user.folderId) {
            const data = await fetchJSONP(`${API_URL}?action=login&identifier=${user.identifier}`);
            if (data.success && data.user.folderId) {
                user.folderId = data.user.folderId;
                user.name = data.user.name;
                localStorage.setItem('eventora_user', JSON.stringify(user));
                document.getElementById('welcome-msg').innerText = `Hello, ${user.name}!`;
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

function editEvent(id) {
    const user = JSON.parse(localStorage.getItem('eventora_user'));
    const events = JSON.parse(localStorage.getItem('eventora_events_' + user.identifier) || '[]');
    const event = events.find(e => e.id === id);

    if (event) {
        editModeId = id;
        document.getElementById('event-name').value = event.name;
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-end-date').value = event.endDate || '';
        document.getElementById('event-fee').value = event.fee;
        document.getElementById('event-venue').value = event.venue || '';
        document.getElementById('event-wa-link').value = event.waLink || '';
        document.getElementById('event-upi-id').value = event.upiId || '';
        document.getElementById('event-desc').value = event.description || '';
        
        document.querySelector('#createModal h2').innerText = "Edit Event";
        document.getElementById('save-event-btn').innerText = "Update Event";
        showCreateModal();
    }
}

const API_URL = "https://script.google.com/macros/s/AKfycbx4xTJrfJwAy8OrLUdSiWTKFy22Qucgnepbp0-61WaS8S8X9IlIpvYeBJLdx9Nwt5lk_Q/exec";

// Event creation logic
async function handleCreateEvent(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-event-btn');
    saveBtn.disabled = true;
    saveBtn.innerText = "Creating... ⏳";

    const user = JSON.parse(localStorage.getItem('eventora_user'));
    
    const formData = new URLSearchParams();
    formData.append('action', 'create_event');
    formData.append('name', document.getElementById('event-name').value);
    formData.append('identifier', user.identifier);
    formData.append('folderId', user.folderId || ''); 

    try {
        // Send data to GAS
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });

    const newEvent = {
        id: 'ev_' + Date.now(),
        name: document.getElementById('event-name').value,
        date: document.getElementById('event-date').value,
        endDate: document.getElementById('event-end-date').value,
        fee: document.getElementById('event-fee').value,
        venue: document.getElementById('event-venue').value,
        waLink: document.getElementById('event-wa-link').value,
        upiId: document.getElementById('event-upi-id').value,
        description: document.getElementById('event-desc').value,
        createdAt: new Date().toISOString()
    };

    const events = JSON.parse(localStorage.getItem('eventora_events_' + user.identifier) || '[]');
    
    if (editModeId) {
        // Update existing
        const index = events.findIndex(e => e.id === editModeId);
        if (index !== -1) {
            events[index] = { ...events[index], ...newEvent, id: editModeId };
            localStorage.setItem('eventora_events_' + user.identifier, JSON.stringify(events));
            alert("✅ Event updated successfully!");
        }
    } else {
        // Create new
        events.push(newEvent);
        localStorage.setItem('eventora_events_' + user.identifier, JSON.stringify(events));
        alert("🎉 Event created successfully!");
    }
    
    setTimeout(() => {
        closeCreateModal();
        loadDashboardData();
        
        saveBtn.disabled = false;
        saveBtn.innerText = "Create Event";
        e.target.reset();
        editModeId = null;
        document.querySelector('#createModal h2').innerText = "New Event";
    }, 1000);

    } catch (err) {
        console.error(err);
        alert("Failed to connect to the backend. Please check your API URL.");
        saveBtn.disabled = false;
        saveBtn.innerText = "Create Event";
    }
}

function viewEvent(id) {
    window.location.href = `event-detail.html?id=${id}`;
}

function deleteEvent(id) {
    const user = JSON.parse(localStorage.getItem('eventora_user'));
    if (confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
        let events = JSON.parse(localStorage.getItem('eventora_events_' + user.identifier) || '[]');
        events = events.filter(e => e.id !== id);
        localStorage.setItem('eventora_events_' + user.identifier, JSON.stringify(events));
        loadDashboardData();
    }
}
