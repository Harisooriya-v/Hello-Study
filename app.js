// ============================================================
// 🚀 VERCEL API CONFIGURATION
//    Requests are routed to your Vercel Serverless Functions (/api/*)
// ============================================================
const API_BASE = '/api'; 

// DOM Elements
const authView = document.getElementById('auth-view');
const switchView = document.getElementById('switch-view');
const appView = document.getElementById('app-view');
const displayUsername = document.getElementById('display-username');
const accountsList = document.getElementById('accounts-list');
const searchInput = document.getElementById('search-input');
const tabChecklists = document.getElementById('tab-checklists');
const tabNotes = document.getElementById('tab-notes');
const checklistSection = document.getElementById('checklist-section');
const notesSection = document.getElementById('notes-section');
const checklistContainer = document.getElementById('checklist-container');
const notesContainer = document.getElementById('notes-container');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');

// New Tab Sections
const tabCalculator = document.getElementById('tab-calculator');
const tabScribble = document.getElementById('tab-scribble');
const calculatorSection = document.getElementById('calculator-section');
const scribbleSection = document.getElementById('scribble-section');

// Calculator DOM Elements
const calcExpr = document.getElementById('calc-expr');
const calcOutput = document.getElementById('calc-output');
const modeDeg = document.getElementById('mode-deg');
const modeRad = document.getElementById('mode-rad');
const calcHistoryBtn = document.getElementById('calc-history-btn');
const calcHistoryPanel = document.getElementById('calc-history-panel');
const calcHistoryList = document.getElementById('calc-history-list');
const clearCalcHistoryBtn = document.getElementById('clear-calc-history');

// Scribble DOM Elements
const scribbleCanvas = document.getElementById('scribble-canvas');
const brushSizeSlider = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');
const customColorInput = document.getElementById('custom-color');
const scribbleGallery = document.getElementById('scribble-gallery');

// State
let currentUser = null; // Structure: { uid: string, email: string, token: string }
let searchQuery = '';
let compressedImageBase64 = null;
let savedAccounts = JSON.parse(localStorage.getItem('hellostudy_accounts') || '[]');

// Calculator State
let calcExpression = "";
let isRadMode = false;
let calcHistory = JSON.parse(localStorage.getItem('hellostudy_calc_history') || '[]');

// Canvas State
let canvasCtx = null;
let isDrawing = false;
let currentTool = 'pen';
let brushColor = '#38bdf8';
let brushSize = 4;
let startX = 0;
let startY = 0;
let undoStack = [];
let redoStack = [];
let canvasImageBuffer = null;

// Helper for authenticated API calls
const apiRequest = async (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser?.token) {
        headers['Authorization'] = `Bearer ${currentUser.token}`;
    }
    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'API request failed');
    }
    return res.json();
};

// --- Navigation ---
const showView = (view) => {
    authView.classList.add('hidden');
    switchView.classList.add('hidden');
    appView.classList.add('hidden');
    if (view === 'auth') authView.classList.remove('hidden');
    if (view === 'switch') {
        switchView.classList.remove('hidden');
        renderAccounts();
    }
    if (view === 'app') appView.classList.remove('hidden');
};

// --- Auth Logic (Migrated to Vercel Endpoint) ---
// --- Auth Logic (Using Browser Storage to Bypass Server Issues) ---
const handleLogin = async () => {
    const email = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;

    if (!email || !pass) {
        showAuthMessage("Please fill in all fields", 'error');
        return;
    }

    // Look for the user inside the browser's local accounts database
    const localUsers = JSON.parse(localStorage.getItem('hellostudy_registered_users') || '[]');
    const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.pass === pass);

    if (user) {
        currentUser = { uid: user.uid, email: user.email, token: "mock_local_token" };
        saveAccount(email, pass);
        onUserAuthenticated();
    } else {
        showAuthMessage("Invalid email or password. Try registering first!", 'error');
    }
};

const handleRegister = async () => {
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value;

    if (!email || !pass) {
        showAuthMessage("Please fill in all fields", 'error');
        return;
    }

    // Get existing users from local storage
    const localUsers = JSON.parse(localStorage.getItem('hellostudy_registered_users') || '[]');
    
    // Check if the email is already taken
    const userExists = localUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (userExists) {
        showAuthMessage("Account already exists locally!", 'error');
        return;
    }

    // Create a new user profile object
    const newUser = {
        uid: 'user_' + Date.now(),
        email: email,
        pass: pass
    };

    // Save the new user into the local storage list
    localUsers.push(newUser);
    localStorage.setItem('hellostudy_registered_users', JSON.stringify(localUsers));

    // Log the user in immediately
    currentUser = { uid: newUser.uid, email: newUser.email, token: "mock_local_token" };
    saveAccount(email, pass);
    onUserAuthenticated();
    showAuthMessage("Registration successful!", 'success');
};
const handleLogout = () => {
    if (currentUser) {
        savedAccounts = savedAccounts.filter(acc => acc.email !== currentUser.email);
        localStorage.setItem('hellostudy_accounts', JSON.stringify(savedAccounts));
    }
    currentUser = null;
    showView('auth');
};

const showAuthMessage = (msg, type = 'info') => {
    const el = document.getElementById('auth-message');
    el.textContent = msg;
    el.style.color = type === 'error' ? '#ef4444' : '#22c55e';
};

const saveAccount = (email, pass) => {
    savedAccounts = savedAccounts.filter(acc => acc.email !== email);
    savedAccounts.unshift({ email, pass });
    localStorage.setItem('hellostudy_accounts', JSON.stringify(savedAccounts));
};

const autoLogin = async (email, pass) => {
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, pass })
        });
        currentUser = { uid: data.uid, email: data.email, token: data.token };
        onUserAuthenticated();
    } catch (error) {
        showAuthMessage("Auto-login failed: " + error.message, 'error');
    }
};

const onUserAuthenticated = () => {
    displayUsername.innerText = currentUser.email.split('@')[0];
    showView('app');
    fetchChecklists();
    fetchNotes();
    fetchScribbles();
};

// --- Image Compression Logic ---
const compressImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
};

// --- Data Operations (Vercel KV / Postgres endpoints) ---
const fetchChecklists = async () => {
    if (!currentUser) return;
    try {
        const items = await apiRequest('/checklists');
        renderChecklist(items);
    } catch (err) {
        console.error("Failed to fetch checklists", err);
    }
};

const addChecklistItem = async () => {
    const title = document.getElementById('new-item-title').value.trim();
    const notes = document.getElementById('new-item-notes').value.trim();
    if (!title) return;
    try {
        await apiRequest('/checklists', {
            method: 'POST',
            body: JSON.stringify({ title, notes })
        });
        document.getElementById('new-item-title').value = '';
        document.getElementById('new-item-notes').value = '';
        fetchChecklists();
    } catch (err) {
        alert("Failed to add item: " + err.message);
    }
};

const fetchNotes = async () => {
    if (!currentUser) return;
    try {
        const items = await apiRequest('/notes');
        renderNotes(items);
    } catch (err) {
        console.error("Failed to fetch notes", err);
    }
};

const addNoteItem = async () => {
    const content = document.getElementById('new-note-content').value.trim();
    if (!content && !compressedImageBase64) return;
    try {
        await apiRequest('/notes', {
            method: 'POST',
            body: JSON.stringify({ content, imageUrl: compressedImageBase64 })
        });
        document.getElementById('new-note-content').value = '';
        clearImagePreview();
        fetchNotes();
    } catch (err) {
        alert("Failed to add note: " + err.message);
    }
};

// --- Rendering ---
const renderChecklist = (items) => {
    checklistContainer.innerHTML = '';
    const filtered = items.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filtered.length === 0) { checklistContainer.innerHTML = '<p class="message">No items found.</p>'; return; }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'checklist-item glass';
        div.innerHTML = `
            <div class="checkbox ${item.isCompleted ? 'checked' : ''}" onclick="window.toggleItem('${item.id}', ${item.isCompleted})"></div>
            <div class="item-content">
                <span class="item-title ${item.isCompleted ? 'completed' : ''}">${item.title}</span>
                ${item.notes ? `<p class="item-notes">${item.notes}</p>` : ''}
            </div>
            <button class="btn-delete" onclick="window.deleteItem('${item.id}', 'checklists')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        checklistContainer.appendChild(div);
    });
};

const renderNotes = (items) => {
    notesContainer.innerHTML = '';
    const filtered = items.filter(i => i.content.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filtered.length === 0) { notesContainer.innerHTML = '<p class="message">No notes found.</p>'; return; }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'note-item glass';
        const dateObj = new Date(item.createdAt);
        div.innerHTML = `
            ${item.imageUrl ? `<img src="${item.imageUrl}" class="note-image">` : ''}
            <div class="note-content">${item.content}</div>
            <div class="note-footer">
                <span>${dateObj.toLocaleDateString()} • ${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <button class="btn-delete" onclick="window.deleteItem('${item.id}', 'notes')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        notesContainer.appendChild(div);
    });
};

const renderAccounts = () => {
    accountsList.innerHTML = '';
    savedAccounts.forEach(acc => {
        const div = document.createElement('div');
        div.className = 'account-item glass';
        div.innerHTML = `
            <div class="account-info">
                <div class="account-avatar">${acc.email[0].toUpperCase()}</div>
                <span class="account-name">${acc.email}</span>
            </div>
            <div class="account-actions">
                <button class="btn-login-small" onclick="window.switchAccount('${acc.email}', '${acc.pass}')">Login</button>
                <button class="btn-delete" onclick="window.removeAccount('${acc.email}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        accountsList.appendChild(div);
    });
};

const clearImagePreview = () => {
    compressedImageBase64 = null;
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
    imageUpload.value = '';
};

// --- Window Bindings ---
window.toggleItem = async (id, current) => {
    try {
        await apiRequest(`/checklists/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isCompleted: !current })
        });
        fetchChecklists();
    } catch (err) { console.error(err); }
};
window.deleteItem = async (id, col) => {
    try {
        await apiRequest(`/${col}/${id}`, { method: 'DELETE' });
        col === 'checklists' ? fetchChecklists() : fetchNotes();
    } catch (err) { console.error(err); }
};
window.switchAccount = autoLogin;
window.removeAccount = (email) => {
    savedAccounts = savedAccounts.filter(a => a.email !== email);
    localStorage.setItem('hellostudy_accounts', JSON.stringify(savedAccounts));
    renderAccounts();
};

// Check if user credentials exist locally for auto-signin emulation
(() => {
    if (savedAccounts.length > 0) {
        autoLogin(savedAccounts[0].email, savedAccounts[0].pass);
    } else {
        showView('auth');
    }
})();

// --- Event Listeners ---
document.getElementById('login-btn').onclick = handleLogin;
document.getElementById('register-btn').onclick = handleRegister;
document.getElementById('logout-btn').onclick = handleLogout;
document.getElementById('switch-user-btn').onclick = () => showView('switch');
document.getElementById('add-account-btn').onclick = () => showView('auth');
document.getElementById('add-item-btn').onclick = addChecklistItem;
document.getElementById('add-note-btn').onclick = addNoteItem;

document.getElementById('new-item-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChecklistItem();
});

document.getElementById('show-register').onclick = (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
};
document.getElementById('show-login').onclick = (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
};

const setupPasswordToggle = (inputId, btnId) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;
    btn.onclick = () => {
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        } else {
            input.type = 'password';
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
    };
};
setupPasswordToggle('login-password', 'toggle-login-pass');
setupPasswordToggle('reg-password', 'toggle-reg-pass');

const activateTab = (activeId) => {
    const tabsList = [
        { btn: tabChecklists, sec: checklistSection },
        { btn: tabNotes, sec: notesSection },
        { btn: tabCalculator, sec: calculatorSection },
        { btn: tabScribble, sec: scribbleSection }
    ];
    tabsList.forEach(t => {
        if (t.btn.id === activeId) {
            t.btn.classList.add('active');
            t.sec.classList.remove('hidden');
        } else {
            t.btn.classList.remove('active');
            t.sec.classList.add('hidden');
        }
    });
    if (activeId === 'tab-scribble') initCanvas();
};

tabChecklists.onclick = () => activateTab('tab-checklists');
tabNotes.onclick = () => activateTab('tab-notes');
tabCalculator.onclick = () => activateTab('tab-calculator');
tabScribble.onclick = () => activateTab('tab-scribble');

searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    fetchChecklists(); fetchNotes();
};

imageUpload.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
        compressedImageBase64 = await compressImage(file);
        imagePreview.src = compressedImageBase64;
        imagePreviewContainer.classList.remove('hidden');
    }
};
document.getElementById('remove-image-btn').onclick = clearImagePreview;

const themeToggle = document.getElementById('theme-toggle');
if (localStorage.getItem('hellostudy_theme') === 'light') document.body.classList.add('light-mode');
themeToggle.onclick = () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('hellostudy_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
};

// ==========================================
// 📊 Scientific Calculator Engine
// ==========================================
const setupCalculator = () => {
    modeDeg.onclick = () => {
        isRadMode = false;
        modeDeg.classList.add('active');
        modeRad.classList.remove('active');
        evaluateLiveExpression();
    };
    modeRad.onclick = () => {
        isRadMode = true;
        modeRad.classList.add('active');
        modeDeg.classList.remove('active');
        evaluateLiveExpression();
    };

    calcHistoryBtn.onclick = (e) => {
        e.stopPropagation();
        calcHistoryPanel.classList.toggle('hidden');
        renderCalcHistory();
    };
    document.addEventListener('click', () => calcHistoryPanel.classList.add('hidden'));
    calcHistoryPanel.onclick = (e) => e.stopPropagation();

    clearCalcHistoryBtn.onclick = () => {
        calcHistory = [];
        localStorage.setItem('hellostudy_calc_history', JSON.stringify([]));
        renderCalcHistory();
    };

    const pressKey = (key) => {
        if (key === 'C') {
            calcExpression = "";
            calcExpr.innerText = "";
            calcOutput.innerText = "0";
        } else if (key === 'backspace') {
            const fns = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt('];
            let deleted = false;
            for (const fn of fns) {
                if (calcExpression.endsWith(fn)) {
                    calcExpression = calcExpression.substring(0, calcExpression.length - fn.length);
                    deleted = true;
                    break;
                }
            }
            if (!deleted) calcExpression = calcExpression.slice(0, -1);
            evaluateLiveExpression();
        } else if (key === '=') {
            finalizeCalculation();
        } else {
            const lastChar = calcExpression.slice(-1);
            if (['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', '(', 'π', 'e'].includes(key)) {
                if (lastChar && (/\d/.test(lastChar) || ['π', 'e', ')', '!'].includes(lastChar))) {
                    calcExpression += '×';
                }
            }
            calcExpression += key;
            evaluateLiveExpression();
        }
        calcExpr.scrollLeft = calcExpr.scrollWidth;
    };

    document.addEventListener('keydown', (e) => {
        if (!calculatorSection.classList.contains('hidden')) {
            const map = {
                '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
                '.':'.', '+':'+', '-':'-', '*':'×', '/':'÷', '^':'^', 'Enter':'=', 'Backspace':'backspace', 'Escape':'C'
            };
            if (map[e.key]) { e.preventDefault(); pressKey(map[e.key]); }
        }
    });

    const bindings = {
        'btn-sin': 'sin(', 'btn-cos': 'cos(', 'btn-tan': 'tan(', 'btn-pow': '^', 'btn-clear': 'C',
        'btn-log': 'log(', 'btn-ln': 'ln(', 'btn-sqrt': 'sqrt(', 'btn-pi': 'π', 'btn-backspace': 'backspace',
        'btn-open-bracket': '(', 'btn-close-bracket': ')', 'btn-fact': '!', 'btn-e': 'e', 'btn-div': '÷',
        'btn-7': '7', 'btn-8': '8', 'btn-9': '9', 'btn-mul': '×', 'btn-sub': '-',
        'btn-4': '4', 'btn-5': '5', 'btn-6': '6', 'btn-add-op': '+', 'btn-equals': '=',
        'btn-1': '1', 'btn-2': '2', 'btn-3': '3', 'btn-0': '0', 'btn-dot': '.'
    };
    Object.keys(bindings).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onclick = () => pressKey(bindings[id]);
    });
};

const evaluateLiveExpression = () => {
    calcExpr.innerText = calcExpression;
    if (!calcExpression) { calcOutput.innerText = "0"; return; }
    const res = safeEval(calcExpression);
    if (res !== "Error" && !isNaN(res) && res !== Infinity && res !== -Infinity) {
        calcOutput.innerText = typeof res === 'number' ? parseFloat(res.toFixed(10)).toString() : res;
    }
};

const finalizeCalculation = () => {
    if (!calcExpression) return;
    const res = safeEval(calcExpression);
    let outputVal = "Error";
    if (res !== "Error" && !isNaN(res)) {
        outputVal = typeof res === 'number' ? parseFloat(res.toFixed(10)).toString() : res;
        calcHistory.unshift({ expr: calcExpression, result: outputVal });
        if (calcHistory.length > 20) calcHistory.pop();
        localStorage.setItem('hellostudy_calc_history', JSON.stringify(calcHistory));
    }
    calcOutput.innerText = outputVal;
    calcExpression = outputVal === "Error" ? "" : outputVal;
    renderCalcHistory();
};

const safeEval = (expr) => {
    let parsed = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E')
        .replace(/\^/g, '**');

    let factRegex = /(\b\d+(?:\.\d+)?|\((?:[^()]+|\([^()]*\))*\))!/g;
    while (parsed.includes('!')) {
        const nextParsed = parsed.replace(factRegex, 'fact($1)');
        if (nextParsed === parsed) break;
        parsed = nextParsed;
    }

    const sinFn = (x) => isRadMode ? Math.sin(x) : Math.sin(x * Math.PI / 180);
    const cosFn = (x) => isRadMode ? Math.cos(x) : Math.cos(x * Math.PI / 180);
    const tanFn = (x) => isRadMode ? Math.tan(x) : Math.tan(x * Math.PI / 180);
    const logFn = (x) => Math.log10(x);
    const lnFn = (x) => Math.log(x);
    const sqrtFn = (x) => Math.sqrt(x);
    const factFn = (x) => {
        let val = Math.floor(x);
        if (val < 0) return NaN;
        if (val === 0 || val === 1) return 1;
        let r = 1;
        for (let i = 2; i <= Math.min(val, 150); i++) r *= i;
        return r;
    };

    try {
        const evaluator = new Function('sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'fact', `
            try { return ${parsed}; } catch (err) { return "Error"; }
        `);
        return evaluator(sinFn, cosFn, tanFn, logFn, lnFn, sqrtFn, factFn);
    } catch (e) {
        return "Error";
    }
};

const renderCalcHistory = () => {
    calcHistoryList.innerHTML = "";
    if (calcHistory.length === 0) {
        calcHistoryList.innerHTML = '<p class="message" style="margin: 0.5rem 0;">No history yet.</p>';
        return;
    }
    calcHistory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item glass';
        div.innerHTML = `<span class="history-expr">${item.expr}</span><span class="history-result">= ${item.result}</span>`;
        div.onclick = () => {
            calcExpression = item.expr;
            evaluateLiveExpression();
            calcHistoryPanel.classList.add('hidden');
        };
        calcHistoryList.appendChild(div);
    });
};

setupCalculator();

// ==========================================
// 🎨 Scribble Pad Drawing Canvas Engine
// ==========================================
const initCanvas = () => {
    if (!canvasCtx) {
        canvasCtx = scribbleCanvas.getContext('2d');
        window.addEventListener('resize', resizeCanvas);

        scribbleCanvas.addEventListener('mousedown', startDrawing);
        scribbleCanvas.addEventListener('mousemove', draw);
        scribbleCanvas.addEventListener('mouseup', stopDrawing);
        scribbleCanvas.addEventListener('mouseout', stopDrawing);

        scribbleCanvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                scribbleCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY }));
            }
        }, { passive: true });
        scribbleCanvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                scribbleCanvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
            }
        }, { passive: true });
        scribbleCanvas.addEventListener('touchend', () => {
            scribbleCanvas.dispatchEvent(new MouseEvent('mouseup', {}));
        }, { passive: true });

        brushSizeSlider.oninput = (e) => {
            brushSize = e.target.value;
            brushSizeVal.innerText = `${brushSize}px`;
        };

        document.querySelectorAll('.color-dot').forEach(dot => {
            dot.onclick = () => {
                document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                brushColor = dot.getAttribute('data-color');
                if (currentTool === 'eraser') setTool('pen');
            };
        });

        customColorInput.onchange = (e) => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            brushColor = e.target.value;
            if (currentTool === 'eraser') setTool('pen');
        };

        document.getElementById('tool-pen').onclick = () => setTool('pen');
        document.getElementById('tool-eraser').onclick = () => setTool('eraser');
        document.getElementById('tool-line').onclick = () => setTool('line');
        document.getElementById('tool-rect').onclick = () => setTool('rect');
        document.getElementById('tool-circle').onclick = () => setTool('circle');

        document.getElementById('canvas-undo').onclick = undoCanvas;
        document.getElementById('canvas-redo').onclick = redoCanvas;
        document.getElementById('canvas-clear').onclick = clearCanvas;
        document.getElementById('canvas-save').onclick = saveScribble;
    }
    resizeCanvas();
};

const setTool = (tool) => {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tool-${tool}`).classList.add('active');
};

const resizeCanvas = () => {
    const rect = scribbleCanvas.parentNode.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    let tempImage = scribbleCanvas.toDataURL();

    scribbleCanvas.width = rect.width * dpr;
    scribbleCanvas.height = rect.height * dpr;
    canvasCtx.scale(dpr, dpr);
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';

    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.fillRect(0, 0, rect.width, rect.height);

    const restoreImg = new Image();
    restoreImg.src = undoStack.length > 0 ? undoStack[undoStack.length - 1] : tempImage;
    restoreImg.onload = () => canvasCtx.drawImage(restoreImg, 0, 0, rect.width, rect.height);
};

const getMousePos = (e) => {
    const rect = scribbleCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

const startDrawing = (e) => {
    isDrawing = true;
    const pos = getMousePos(e);
    startX = pos.x;
    startY = pos.y;
    canvasCtx.beginPath();
    canvasCtx.moveTo(startX, startY);
    const rect = scribbleCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasImageBuffer = canvasCtx.getImageData(0, 0, rect.width * dpr, rect.height * dpr);
};

const draw = (e) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    const currentX = pos.x;
    const currentY = pos.y;

    canvasCtx.lineWidth = brushSize;
    canvasCtx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : brushColor;

    if (currentTool === 'pen' || currentTool === 'eraser') {
        canvasCtx.lineTo(currentX, currentY);
        canvasCtx.stroke();
    } else {
        canvasCtx.putImageData(canvasImageBuffer, 0, 0);
        canvasCtx.beginPath();
        if (currentTool === 'line') {
            canvasCtx.moveTo(startX, startY);
            canvasCtx.lineTo(currentX, currentY);
        } else if (currentTool === 'rect') {
            canvasCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
            canvasCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
        }
        canvasCtx.stroke();
    }
};

const stopDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    pushCanvasState();
};

const pushCanvasState = () => {
    undoStack.push(scribbleCanvas.toDataURL());
    if (undoStack.length > 25) undoStack.shift();
    redoStack = [];
};

const undoCanvas = () => {
    if (undoStack.length <= 1) { clearCanvas(false); return; }
    const undone = undoStack.pop();
    redoStack.push(undone);
    const img = new Image();
    img.src = undoStack[undoStack.length - 1];
    img.onload = () => {
        const rect = scribbleCanvas.getBoundingClientRect();
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.fillRect(0, 0, rect.width, rect.height);
        canvasCtx.drawImage(img, 0, 0, rect.width, rect.height);
    };
};

const redoCanvas = () => {
    if (redoStack.length === 0) return;
    const state = redoStack.pop();
    undoStack.push(state);
    const img = new Image();
    img.src = state;
    img.onload = () => {
        const rect = scribbleCanvas.getBoundingClientRect();
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.fillRect(0, 0, rect.width, rect.height);
        canvasCtx.drawImage(img, 0, 0, rect.width, rect.height);
    };
};

const clearCanvas = (resetHistory = true) => {
    const rect = scribbleCanvas.getBoundingClientRect();
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.fillRect(0, 0, rect.width, rect.height);
    if (resetHistory) pushCanvasState();
};

const saveScribble = async () => {
    if (!currentUser) { alert("Please login to save scribbles."); return; }
    const base64Data = scribbleCanvas.toDataURL('image/png');
    try {
        await apiRequest('/scribbles', {
            method: 'POST',
            body: JSON.stringify({ imageUrl: base64Data })
        });
        fetchScribbles();
        alert("Sketch saved to gallery!");
    } catch (err) {
        alert("Failed to save sketch: " + err.message);
    }
};

const fetchScribbles = async () => {
    if (!currentUser) return;
    try {
        const items = await apiRequest('/scribbles');
        renderScribbleGallery(items);
    } catch (e) {
        console.error("Error reading saved scribbles:", e);
    }
};

const renderScribbleGallery = (items) => {
    scribbleGallery.innerHTML = "";
    if (items.length === 0) {
        scribbleGallery.innerHTML = '<p class="message">No saved scribbles yet. Sketch something above and hit save!</p>';
        return;
    }
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item glass';
        const dateObj = new Date(item.createdAt);
        const formattedDate = `${dateObj.toLocaleDateString()} • ${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        div.innerHTML = `
            <img src="${item.imageUrl}" class="gallery-preview">
            <div class="gallery-footer">
                <span>${formattedDate}</span>
                <div class="gallery-actions">
                    <button class="btn-icon-small" onclick="window.downloadScribble('${item.imageUrl}', '${item.id}')" title="Download Image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button class="btn-icon-small delete" onclick="window.deleteScribble('${item.id}')" title="Delete Sketch">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
        scribbleGallery.appendChild(div);
    });
};

window.downloadScribble = (dataUrl, id) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `hellostudy_sketch_${id.substring(0, 5)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.deleteScribble = async (id) => {
    if (confirm("Are you sure you want to delete this sketch?")) {
        try {
            await apiRequest(`/scribbles/${id}`, { method: 'DELETE' });
            fetchScribbles();
        } catch (err) { console.error(err); }
    }
};
