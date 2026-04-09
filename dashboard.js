/**
 * Eventora Dashboard Logic
 * Handles Event management and UI synchronization
 */

const API_URL = 'https://script.google.com/macros/s/AKfycby-tuuL2zz38uXKlm_jjU8lTBrSRNxngFKoM7x8RixHdkO5dMzbHQtkW_ncP2nReZaIaA/exec';

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboardData();
    setupPrefixAutoGenerator();
    setupSettingsDesigner();
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
                reject(new Error('Cloud request timed out (30s)'));
            }
        }, 30000);
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

// Section Management
function switchSection(id, btn) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(`section-${id}`).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    btn.classList.add('active');
    
    if (id === 'settings') {
        updatePreview();
    }
}

/* Date & Time Helpers */
function toDisplayDate(val) {
    if (!val) return '--';
    const d = new Date(val);
    if (isNaN(d)) return val;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function toInputDate(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d)) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toInputTime(val) {
    if (!val) return '';
    // If it's already HH:MM
    if (/^\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (isNaN(d)) return val; // Fallback
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Modal handling
function showCreateModal() {
    const form = document.getElementById('create-event-form');
    form.reset();
    document.getElementById('event-id').value = '';
    document.getElementById('modal-title').innerText = "Create New Event";
    document.getElementById('create-modal').classList.add('active');
    lucide.createIcons();
}

function closeCreateModal() {
    document.getElementById('create-modal').classList.remove('active');
}

// --- Expense Modal ---
function openExpenseModal(eventId, e) {
    if (e) e.stopPropagation();
    document.getElementById('expense-event-id').value = eventId;
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-title').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-modal').classList.add('active');
    lucide.createIcons();
}

function closeExpenseModal() {
    document.getElementById('expense-modal').classList.remove('active');
}

function saveExpense(e) {
    e.preventDefault();
    const eventId = document.getElementById('expense-event-id').value;
    const title = document.getElementById('expense-title').value;
    const amount = document.getElementById('expense-amount').value;
    const date = document.getElementById('expense-date').value;

    const expense = {
        title,
        amount,
        date,
        id: Date.now()
    };

    const localExpenses = JSON.parse(localStorage.getItem('eventora_local_expenses_' + eventId) || '[]');
    localExpenses.push(expense);
    localStorage.setItem('eventora_local_expenses_' + eventId, JSON.stringify(localExpenses));

    closeExpenseModal();
    loadDashboardData(); // Refresh UI
    alert("✅ Expense added successfully!");
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

    container.innerHTML = events.map(event => {
        const collections = event.earnings || 0;
        const localExpenses = JSON.parse(localStorage.getItem('eventora_local_expenses_' + event.id) || '[]');
        const totalLocalAmount = localExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        
        const totalExp = (event.expenses || 0) + totalLocalAmount;
        const pnl = collections - totalExp;
        const pnlClass = pnl >= 0 ? 'badge-profit' : 'badge-loss';
        const pnlSign = pnl >= 0 ? '+' : '';

        return `
        <div class="glass glass-hover event-card" style="margin-bottom: 1rem; display: block; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="background: rgba(99, 102, 241, 0.1); width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 0.75rem; color: var(--primary);">
                        <i data-lucide="calendar"></i>
                    </div>
                    <div>
                        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.2rem;">${event.name}</h4>
                        <p style="color: var(--text-muted); font-size: 0.8rem;">
                            <i data-lucide="calendar-days" size="14" style="vertical-align: middle;"></i> ${toDisplayDate(event.date)}
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-direction: column; align-items: end;">
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="padding: 0.5rem; color: var(--primary);" onclick="editEvent('${event.id}', event)"><i data-lucide="pencil" size="16"></i></button>
                        <button class="btn btn-outline" style="padding: 0.5rem; color: #f87171;" onclick="deleteEvent('${event.id}', event)"><i data-lucide="trash-2" size="16"></i></button>
                    </div>
                    <button class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; border-color: #a855f7; color: #a855f7; margin-top: 0.5rem;" onclick="openExpenseModal('${event.id}', event)">
                        <i data-lucide="plus" size="14"></i> Add Expense
                    </button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 1rem; border: 1px solid var(--glass-border);">
                <div style="text-align: center;">
                    <p style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Date</p>
                    <p style="font-weight: 700; font-size: 0.75rem;">${toDisplayDate(event.date)}</p>
                </div>
                <div style="text-align: center;">
                    <p style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Fee</p>
                    <p style="font-weight: 700; font-size: 0.75rem;">₹${event.fee}</p>
                </div>
                <div style="text-align: center;">
                    <p style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Students</p>
                    <p style="font-weight: 700; font-size: 0.75rem;">${event.participantCount || 0}</p>
                </div>
                <div style="text-align: center;">
                    <p style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">P&L</p>
                    <span class="badge-finance ${pnlClass}" style="font-size: 0.65rem;">${pnlSign}₹${Math.abs(pnl).toLocaleString()}</span>
                </div>
            </div>

            <button class="btn btn-primary" style="width: 100%; height: 3rem; font-weight: 700;" onclick="viewEvent('${event.id}')">
                Manage Event <i data-lucide="chevron-right" size="18" style="margin-left: 0.5rem;"></i>
            </button>
        </div>
        `;
    }).join('');
    lucide.createIcons();
}

function updateStats(events) {
    let totalEarnings = 0;
    let totalExpenses = 0;
    
    events.forEach(e => {
        totalEarnings += e.earnings || 0;
        const localExpenses = JSON.parse(localStorage.getItem('eventora_local_expenses_' + e.id) || '[]');
        const totalLocalAmount = localExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        totalExpenses += (e.expenses || 0) + totalLocalAmount;
    });

    const pnl = totalEarnings - totalExpenses;

    document.getElementById('total-events-stat').innerText = events.length;
    document.getElementById('total-earnings-stat').innerText = `₹${totalEarnings.toLocaleString()}`;
    document.getElementById('total-expenses-stat').innerText = `₹${totalExpenses.toLocaleString()}`;
    
    const pnlEl = document.getElementById('total-pnl-stat');
    pnlEl.innerText = `₹${pnl.toLocaleString()}`;
    
    // Applying the new utility classes
    const pnlCard = pnlEl.closest('.stat-card');
    if (pnl >= 0) {
        pnlEl.className = "text-profit";
        if (pnlCard) pnlCard.style.borderColor = "rgba(34, 197, 94, 0.3)";
    } else {
        pnlEl.className = "text-loss";
        if (pnlCard) pnlCard.style.borderColor = "rgba(248, 113, 113, 0.3)";
    }
}

/**
 * Automatically suggests a prefix based on Event Name
 */
function setupPrefixAutoGenerator() {
    const nameInput = document.getElementById('event-name');
    const prefixInput = document.getElementById('event-prefix');
    
    if (!nameInput || !prefixInput) return;

    nameInput.addEventListener('input', () => {
        // Only auto-generate if prefix is currently default or empty
        if (prefixInput.value === 'A' || prefixInput.value === '') {
            const name = nameInput.value.trim();
            if (name.length > 0) {
                // Get first letters of each word (e.g. Summer Camp -> SC)
                const words = name.split(/\s+/);
                let suggested = words.map(w => w[0].toUpperCase()).join('').substring(0, 3);
                
                // Fallback: Use first two letters if one word
                if (suggested.length === 1 && name.length > 1) {
                    suggested = name.substring(0, 2).toUpperCase();
                }
                
                prefixInput.value = suggested;
            }
        }
    });
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
            document.getElementById('event-date').value = toInputDate(data.startDate);
            document.getElementById('event-end-date').value = toInputDate(data.endDate);
            document.getElementById('event-start-time').value = toInputTime(data.startTime);
            document.getElementById('event-end-time').value = toInputTime(data.endTime);
            document.getElementById('event-fee').value = data.fee || '100';
            document.getElementById('event-prefix').value = data.prefix || 'A';
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
        startTime: document.getElementById('event-start-time').value,
        endTime: document.getElementById('event-end-time').value,
        fee: document.getElementById('event-fee').value,
        prefix: document.getElementById('event-prefix').value || 'A',
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

// ---------------------------------------------------------
// ID CARD DESIGNER LOGIC
// ---------------------------------------------------------

const DEFAULT_CARD_SETTINGS = {
    theme: {
        primary: '#6366f1',
        accent: '#a855f7'
    },
    layout: {
        cardsPerPage: 8
    },
    header: {
        text: 'EVENT NAME',
        fontSize: '0.9rem'
    },
    footer: {
        text: 'Official Eventora Cloud ID System',
        fontSize: '0.65rem'
    },
    fields: {
        name: { visible: true, fontSize: '1.2rem' },
        phone: { visible: true, fontSize: '0.7rem' },
        dob: { visible: true, fontSize: '0.7rem' },
        gender: { visible: true, fontSize: '0.7rem' },
        age: { visible: true, fontSize: '0.7rem' },
        address: { visible: true, fontSize: '0.6rem' },
        id: { visible: true, fontSize: '0.7rem' }
    },
    photo: {
        visible: true,
        width: '85px',
        height: '100px'
    }
};

function setupSettingsDesigner() {
    // Load existing settings or use defaults
    const saved = localStorage.getItem('eventora_id_settings');
    const settings = saved ? JSON.parse(saved) : DEFAULT_CARD_SETTINGS;
    
    // Fill UI with values
    const primaryInput = document.getElementById('set-color-primary');
    if (!primaryInput) return; // Not on settings page yet

    primaryInput.value = settings.theme.primary;
    document.getElementById('set-color-primary-hex').value = settings.theme.primary;
    document.getElementById('set-color-accent').value = settings.theme.accent;
    document.getElementById('set-color-accent-hex').value = settings.theme.accent;
    document.getElementById('set-layout-grid').value = settings.layout.cardsPerPage;
    
    document.getElementById('set-header-text').value = settings.header.text;
    document.getElementById('set-header-fs').value = settings.header.fontSize;
    document.getElementById('set-footer-text').value = settings.footer.text;
    document.getElementById('set-footer-fs').value = settings.footer.fontSize;
    
    document.getElementById('set-field-name-vis').checked = settings.fields.name.visible;
    document.getElementById('set-field-name-fs').value = settings.fields.name.fontSize;
    document.getElementById('set-field-phone-vis').checked = settings.fields.phone.visible;
    document.getElementById('set-field-phone-fs').value = settings.fields.phone.fontSize;
    document.getElementById('set-field-dob-vis').checked = settings.fields.dob.visible;
    document.getElementById('set-field-dob-fs').value = settings.fields.dob.fontSize;
    document.getElementById('set-field-gender-vis').checked = settings.fields.gender.visible;
    document.getElementById('set-field-gender-fs').value = settings.fields.gender.fontSize;
    document.getElementById('set-field-age-vis').checked = settings.fields.age.visible;
    document.getElementById('set-field-age-fs').value = settings.fields.age.fontSize;
    document.getElementById('set-field-address-vis').checked = settings.fields.address.visible;
    document.getElementById('set-field-address-fs').value = settings.fields.address.fontSize;
    document.getElementById('set-field-id-vis').checked = settings.fields.id.visible;
    document.getElementById('set-field-id-fs').value = settings.fields.id.fontSize;
    
    document.getElementById('set-photo-vis').checked = settings.photo.visible;
    document.getElementById('set-photo-w').value = settings.photo.width;
    document.getElementById('set-photo-h').value = settings.photo.height;
    
    document.getElementById('set-footer-theme-sync').checked = settings.footer.themeSync || false;

    updatePreview();
}

function collectSettings() {
    return {
        theme: {
            primary: document.getElementById('set-color-primary').value,
            accent: document.getElementById('set-color-accent').value
        },
        layout: {
            cardsPerPage: parseInt(document.getElementById('set-layout-grid').value)
        },
        header: {
            text: document.getElementById('set-header-text').value,
            fontSize: document.getElementById('set-header-fs').value
        },
        footer: {
            text: document.getElementById('set-footer-text').value,
            fontSize: document.getElementById('set-footer-fs').value,
            themeSync: document.getElementById('set-footer-theme-sync').checked
        },
        fields: {
            name: { visible: document.getElementById('set-field-name-vis').checked, fontSize: document.getElementById('set-field-name-fs').value },
            phone: { visible: document.getElementById('set-field-phone-vis').checked, fontSize: document.getElementById('set-field-phone-fs').value },
            dob: { visible: document.getElementById('set-field-dob-vis').checked, fontSize: document.getElementById('set-field-dob-fs').value },
            gender: { visible: document.getElementById('set-field-gender-vis').checked, fontSize: document.getElementById('set-field-gender-fs').value },
            age: { visible: document.getElementById('set-field-age-vis').checked, fontSize: document.getElementById('set-field-age-fs').value },
            address: { visible: document.getElementById('set-field-address-vis').checked, fontSize: document.getElementById('set-field-address-fs').value },
            id: { visible: document.getElementById('set-field-id-vis').checked, fontSize: document.getElementById('set-field-id-fs').value }
        },
        photo: {
            visible: document.getElementById('set-photo-vis').checked,
            width: document.getElementById('set-photo-w').value,
            height: document.getElementById('set-photo-h').value
        }
    };
}

function updatePreview() {
    const s = collectSettings();
    document.getElementById('set-color-primary-hex').value = s.theme.primary;
    document.getElementById('set-color-accent-hex').value = s.theme.accent;
    
    const container = document.getElementById('designer-preview-container');
    if (!container) return;
    
    // Sync styles for the preview ID Card
    const previewHTML = `
        <div style="width: 3.5in; height: 2.25in; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; font-family: 'Outfit', sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transform: scale(1.1);">
            <div style="background: linear-gradient(135deg, ${s.theme.primary}, ${s.theme.accent}) !important; color: #fff; height: 42px; display: ${s.header.text ? 'flex' : 'none'}; align-items: center; justify-content: center; font-weight: 800; font-size: ${s.header.fontSize}; text-transform: uppercase; padding: 0 10px; text-align: center;">
                ${s.header.text}
            </div>
            <div style="flex: 1; padding: 12px 16px; display: flex; gap: 16px; align-items: center; background: #fff;">
                ${s.photo.visible ? `
                    <div style="text-align: center;">
                        <div style="width: ${s.photo.width}; height: ${s.photo.height}; border: 2px solid ${s.theme.primary}; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
                            <i data-lucide="user" size="32"></i>
                        </div>
                        ${s.fields.id.visible ? `<div style="background: linear-gradient(135deg, ${s.theme.primary}, ${s.theme.accent}); color: #fff; font-size: ${s.fields.id.fontSize}; font-weight: 800; padding: 3px 10px; border-radius: 6px; display: inline-block; margin-top: 6px;">ID: SE001</div>` : ''}
                    </div>
                ` : ''}
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    ${s.fields.name.visible ? `<div style="font-size: ${s.fields.name.fontSize}; font-weight: 800; color: #1e293b; margin-bottom: 4px; line-height: 1.1; text-transform: uppercase;">PRADEEP GUPTA</div>` : ''}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 2px;">
                        ${s.fields.phone.visible ? `<div><div style="font-size: 0.5rem; color: #94a3b8; font-weight: 700;">PHONE</div><div style="font-size: ${s.fields.phone.fontSize}; color: #1e293b; font-weight: 600;">9876543210</div></div>` : ''}
                        ${s.fields.dob.visible ? `<div><div style="font-size: 0.5rem; color: #94a3b8; font-weight: 700;">DOB</div><div style="font-size: ${s.fields.dob.fontSize}; color: #1e293b; font-weight: 600;">15-08-1995</div></div>` : ''}
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 2px;">
                        ${s.fields.gender.visible ? `<div><div style="font-size: 0.5rem; color: #94a3b8; font-weight: 700;">GENDER</div><div style="font-size: ${s.fields.gender.fontSize}; color: #1e293b; font-weight: 600;">MALE</div></div>` : ''}
                        ${s.fields.age.visible ? `<div><div style="font-size: 0.5rem; color: #94a3b8; font-weight: 700;">AGE</div><div style="font-size: ${s.fields.age.fontSize}; color: #1e293b; font-weight: 600;">28</div></div>` : ''}
                    </div>

                    ${s.fields.address.visible ? `
                        <div style="margin-top: 4px;">
                            <div style="font-size: 0.5rem; color: #94a3b8; font-weight: 700;">ADDRESS</div>
                            <div style="font-size: ${s.fields.address.fontSize}; line-height: 1.2; color: #64748b;">123, Green Park Road, Mumbai</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div style="background: #1e293b; color: #94a3b8; height: 28px; display: ${s.footer.text ? 'flex' : 'none'}; align-items: center; justify-content: center; font-size: ${s.footer.fontSize}; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                ${s.footer.text}
            </div>
        </div>
    `;
    
    container.innerHTML = previewHTML;
    lucide.createIcons();
}

async function saveSettings() {
    const s = collectSettings();
    localStorage.setItem('eventora_id_settings', JSON.stringify(s));
    
    const saveBtn = document.querySelector('.btn-primary[onclick="saveSettings()"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = "Syncing with Cloud... \u23f3";
    }

    try {
        const payload = {
            action: 'save_app_config',
            key: 'id_card_designer',
            value: JSON.stringify(s)
        };
        
        const data = await fetchJSONP(`${API_URL}?${new URLSearchParams(payload).toString()}`);
        if (data.success) {
            alert("✅ ID Card settings saved to Cloud! These will be used for all students and admins.");
        } else {
            alert("⚠️ Saved locally, but cloud sync failed: " + data.message);
        }
    } catch (err) {
        console.error("Cloud Error:", err);
        alert("⚠️ Saved locally, but couldn't sync with cloud. Check internet connection.");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = "Save Changes";
        }
    }
}
