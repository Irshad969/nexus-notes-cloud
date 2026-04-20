const API_URL  = '/api/notes';
let isVaultMode = false;
let recognition;
let isRecording  = false;
let pendingResendEmail = '';

// =====================
// SUPABASE SETUP
// =====================
const supabaseUrl = 'https://ddefoyzvnbdjumunkkkg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZWZveXp2bmJkanVtdW5ra2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTUyMzQsImV4cCI6MjA5MjI3MTIzNH0.rK1n_dUcbxQS6iY2FNDP1wZtXsjTUxQTAaWRa1o5pvw';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// =====================
// AUTH HELPERS
// =====================

let currentToken = null;

function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` }; }

function showApp(username) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('header-username').textContent = username;
}

function showAuth() {
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    showLoginRegisterForms();
}

function showLoginRegisterForms() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('email-sent-screen').classList.add('hidden');
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.querySelector('.auth-tabs').style.display = 'flex';
}

function showEmailSentScreen(email) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelector('.auth-tabs').style.display = 'none';
    document.getElementById('email-sent-to').textContent = `We sent a verification link to ${email}`;
    document.getElementById('email-sent-screen').classList.remove('hidden');
    pendingResendEmail = email;
}

function backToLogin() {
    showLoginRegisterForms();
    switchAuthTab('login');
}

function switchAuthTab(tab) {
    const loginForm    = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin     = document.getElementById('tab-login');
    const tabRegister  = document.getElementById('tab-register');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
}

// =====================
// BOOT: Check session & URL params
// =====================

// =====================
// BOOT: Check session
// =====================

document.addEventListener('DOMContentLoaded', async () => {
    // Supabase handles token URLs automatically. 
    // We just need to get the session on load.
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentToken = session.access_token;
        const username = session.user.user_metadata.username || session.user.email.split('@')[0];
        showApp(username);
        fetchNotes();
        initSpeechRecognition();
    } else {
        showAuth();
    }

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentToken = session.access_token;
            const username = session.user.user_metadata.username || session.user.email.split('@')[0];
            showApp(username);
            fetchNotes();
            if (!recognition) initSpeechRecognition();
        } else if (event === 'SIGNED_OUT') {
            currentToken = null;
            showAuth();
            renderNotes([]);
        }
    });
});

// =====================
// REGISTER
// =====================

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn      = document.getElementById('register-btn');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { username: username }
            }
        });

        if (error) {
            Swal.fire({ icon: 'error', title: 'Registration Failed', text: error.message, background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' });
        } else {
            showEmailSentScreen(email);
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Network Error', text: err.message });
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
        btn.disabled = false;
    }
}

// =====================
// RESEND VERIFICATION
// =====================

async function resendVerification() {
    if (!pendingResendEmail) return;
    const btn = document.getElementById('resend-btn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    btn.disabled = true;

    try {
        const { error } = await supabaseClient.auth.resend({
            type: 'signup',
            email: pendingResendEmail,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        
        Swal.fire({ icon: 'success', title: 'Email Sent!', text: 'Verification email resent! Check your inbox.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3500 });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Resend Email';
        btn.disabled = false;
    }
}

// =====================
// LOGIN
// =====================

async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-btn');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            // Check if it's an unverified email error
            if (error.message.includes('Email not confirmed')) {
                const { isConfirmed } = await Swal.fire({
                    icon: 'warning',
                    title: 'Email Not Verified',
                    text: 'Please check your inbox and click the verification link. Want us to resend it?',
                    showCancelButton: true,
                    confirmButtonText: '📩 Resend Email',
                    cancelButtonText: 'Cancel',
                    background: 'rgba(15,23,42,0.97)',
                    color: '#F8FAFC',
                    confirmButtonColor: '#7C3AED'
                });
                if (isConfirmed) {
                    pendingResendEmail = email;
                    showEmailSentScreen(pendingResendEmail);
                    await resendVerification();
                }
            } else {
                Swal.fire({ icon: 'error', title: 'Login Failed', text: error.message, background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' });
            }
        } else {
            // Success handled by onAuthStateChange in boot
            const username = data.user.user_metadata.username || email.split('@')[0];
            Swal.fire({ icon: 'success', title: `Welcome back, ${username}!`, toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Network Error', text: err.message });
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
        btn.disabled = false;
    }
}

// =====================
// LOGOUT
// =====================

async function handleLogout() {
    const result = await Swal.fire({
        title: 'Log out?',
        text: 'You will need to log in again to access your notes.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, logout',
        background: 'rgba(15,23,42,0.97)',
        color: '#F8FAFC',
        confirmButtonColor: '#7C3AED'
    });
    if (result.isConfirmed) {
        await supabaseClient.auth.signOut();
        isVaultMode = false;
        document.body.classList.remove('vault-mode');
        // UI updates are handled by onAuthStateChange event in boot
    }
}

// =====================
// SPEECH
// =====================

function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = function(e) {
            let t = '';
            for (let i = e.resultIndex; i < e.results.length; ++i)
                if (e.results[i].isFinal) t += e.results[i][0].transcript;
            if (t) {
                const box = document.getElementById('note-content');
                box.value += (box.value.endsWith(' ') || !box.value ? '' : ' ') + t;
                updateCharCount();
            }
        };
        recognition.onerror = () => stopDictation();
        recognition.onend   = () => stopDictation();
    }
}

function toggleDictation() {
    if (!recognition) return Swal.fire('Not Supported', 'Your browser does not support Voice Dictation.', 'error');
    if (isRecording) stopDictation();
    else {
        document.getElementById('mic-btn').classList.add('recording');
        recognition.start(); isRecording = true;
        Swal.fire({ title: 'Listening...', text: 'Speak your note.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    }
}

function stopDictation() {
    if (recognition) recognition.stop();
    document.getElementById('mic-btn').classList.remove('recording');
    isRecording = false;
}

function readAloudNote(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const s = new SpeechSynthesisUtterance(text);
        s.rate = 1; s.pitch = 1;
        window.speechSynthesis.speak(s);
        Swal.fire({ title: 'Reading Note...', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    }
}

function updateCharCount() {
    document.getElementById('char-count').innerText = `${document.getElementById('note-content').value.length} characters`;
}

function filterNotes() {
    const q = document.getElementById('search-input').value.toLowerCase();
    document.querySelectorAll('.note-card').forEach(c => {
        const t = c.querySelector('h3').innerText.toLowerCase();
        const p = c.querySelector('p').innerText.toLowerCase();
        const b = c.querySelector('.category-badge').innerText.toLowerCase();
        c.style.display = (t.includes(q) || p.includes(q) || b.includes(q)) ? 'flex' : 'none';
    });
}

// =====================
// NOTES CRUD
// =====================

async function fetchNotes() {
    try {
        const res = await fetch(API_URL + (isVaultMode ? '?secret=true' : ''), { headers: authHeaders() });
        if (res.status === 401 || res.status === 403) { localStorage.removeItem('nexus_token'); showAuth(); return; }
        if (!res.ok) throw new Error('DB Error');
        displayNotes(await res.json());
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Could not connect to Database.' });
    }
}

function displayNotes(notes) {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    if (!notes.length) {
        list.innerHTML = `<div style="color:#64748B;text-align:center;grid-column:1/-1;padding:4rem;display:flex;flex-direction:column;align-items:center;gap:15px;">
            <i class="fa-solid fa-folder-open" style="font-size:3rem;opacity:0.5;"></i>
            <p>No ${isVaultMode ? 'secret ' : ''}records found.</p></div>`;
        return;
    }
    notes.forEach((note, index) => {
        const el = document.createElement('div');
        el.classList.add('note-card');
        el.style.animationDelay = `${index * 0.05}s`;
        const dateStr = new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const catClass = `cat-${(note.category || 'General').toLowerCase()}`;
        el.innerHTML = `
            <div class="category-badge ${catClass}">${note.category || 'General'}</div>
            <h3>${note.title}</h3>
            <div class="note-date">
                <i class="fa-regular fa-clock"></i> ${dateStr}
                ${isVaultMode ? '<i class="fa-solid fa-lock" style="color:#EF4444;margin-left:5px;"></i>' : ''}
                <div class="util-btns">
                    <button onclick="readAloudNote(\`${note.content.replace(/`/g,'\\`')}\`)" title="Read Aloud"><i class="fa-solid fa-volume-up"></i></button>
                    <button onclick="copyNoteContent(this,\`${note.content.replace(/`/g,'\\`')}\`)" title="Copy"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="downloadNote(\`${note.title.replace(/`/g,'\\`')}\`,\`${note.content.replace(/`/g,'\\`')}\`)" title="Download"><i class="fa-solid fa-download"></i></button>
                </div>
            </div>
            <p>${note.content}</p>
            <div class="card-actions">
                <button class="toggle-secret-btn" onclick="toggleSecretStatus('${note._id}',${note.isSecret})">
                    ${isVaultMode ? '<i class="fa-solid fa-eye"></i> Unhide' : '<i class="fa-solid fa-eye-slash"></i> Hide'}
                </button>
                <button class="edit-btn" onclick="editNote('${note._id}',\`${note.title.replace(/`/g,'\\`')}\`,\`${note.content.replace(/`/g,'\\`')}\`,'${note.category||'General'}')">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="delete-btn" onclick="deleteNote('${note._id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        list.appendChild(el);
    });
}

function copyNoteContent(btn, content) {
    navigator.clipboard.writeText(content).then(() => {
        const o = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color:#34D399;"></i>';
        setTimeout(() => btn.innerHTML = o, 2000);
    });
}

function downloadNote(title, content) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = `${title.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function exportAllNotes() {
    try {
        const res = await fetch(API_URL + (isVaultMode ? '?secret=true' : ''), { headers: authHeaders() });
        const notes = await res.json();
        if (!notes.length) return Swal.fire({ icon: 'info', title: 'Empty', text: 'No notes to export' });
        let d = "--- NEXUS NOTES EXPORT ---\n\n";
        notes.forEach(n => { d += `Title: ${n.title}\nCategory: ${n.category||'General'}\nDate: ${new Date(n.createdAt).toLocaleString()}\n\n${n.content}\n\n---------------------------\n\n`; });
        downloadNote(`NexusNotes_Export_${Date.now()}`, d);
        Swal.fire({ icon: 'success', title: 'Exported!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
    } catch(e) { console.error(e); }
}

async function saveNote() {
    const id       = document.getElementById('edit-id').value;
    const title    = document.getElementById('note-title').value.trim();
    const content  = document.getElementById('note-content').value.trim();
    const category = document.getElementById('note-category').value;
    if (!title || !content) return Swal.fire({ icon: 'warning', title: 'Empty Fields' });

    const btn = document.getElementById('save-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
    btn.disabled = true;

    try {
        const url  = id ? `${API_URL}/${id}` : API_URL;
        const body = id ? { title, content, category } : { title, content, category, isSecret: isVaultMode };
        const res  = await fetch(url, { method: id ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) });
        if (res.status === 401 || res.status === 403) { localStorage.removeItem('nexus_token'); showAuth(); return; }
        if (res.ok) {
            cancelEdit();
            Swal.fire({ icon: 'success', title: id ? 'Updated!' : 'Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            fetchNotes();
        }
    } catch(e) { console.error(e); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

function editNote(id, title, content, category) {
    document.getElementById('edit-id').value = id;
    document.getElementById('note-title').value = title;
    document.getElementById('note-content').value = content;
    document.getElementById('note-category').value = category;
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen-nib"></i> Edit Note';
    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-check"></i> Update Note';
    document.getElementById('cancel-btn').style.display = 'block';
    updateCharCount();
    document.getElementById('form-panel').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('edit-id').value = '';
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    document.getElementById('note-category').value = 'General';
    document.getElementById('form-title').innerHTML = '<i class="fa-solid fa-pen-nib"></i> Create Note';
    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-paper-plane"></i> Save Note';
    document.getElementById('cancel-btn').style.display = 'none';
    updateCharCount();
}

function deleteNote(id) {
    Swal.fire({ title: 'Delete Record?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete!', background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' })
        .then(async r => { if (r.isConfirmed) { await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() }); fetchNotes(); } });
}

async function toggleSecretStatus(id, isSecretCurrently) {
    if (!isSecretCurrently && !localStorage.getItem('vaultPin')) {
        return Swal.fire({ icon: 'info', title: 'Vault Not Setup', text: 'Please click "Hidden Vault" first to setup your vault password.' });
    }
    const action = isSecretCurrently ? 'Unhide' : 'Hide';
    const r = await Swal.fire({ title: `${action} Note?`, text: isSecretCurrently ? 'Move back to public?' : 'Move into secret Vault?', icon: 'question', showCancelButton: true, confirmButtonText: `Yes, ${action}`, background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' });
    if (r.isConfirmed) {
        const res = await fetch(`${API_URL}/${id}/toggle-secret`, { method: 'PUT', headers: authHeaders() });
        if (res.ok) { Swal.fire({ icon: 'success', title: isSecretCurrently ? 'Unhidden!' : 'Hidden!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }); fetchNotes(); }
    }
}

async function toggleVault() {
    if (isVaultMode) {
        isVaultMode = false;
        document.body.classList.remove('vault-mode');
        document.querySelector('.vault-btn').innerHTML = '<i class="fa-solid fa-lock"></i> Hidden Vault';
        document.getElementById('mode-subtitle').innerText = 'Secure Cloud Architecture • DBaaS • PaaS';
        fetchNotes();
    } else {
        let savedPin = localStorage.getItem('vaultPin');
        if (!savedPin) {
            const { value: np } = await Swal.fire({ title: 'Create Vault Password', text: 'Set a password for your secret notes.', input: 'password', confirmButtonText: 'Save Password', background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' });
            if (!np) return;
            localStorage.setItem('vaultPin', np); savedPin = np;
            Swal.fire({ icon: 'success', title: 'Password Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        }
        const { value: pin } = await Swal.fire({ title: 'Enter Vault Password', input: 'password', confirmButtonText: 'Unlock Vault', background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' });
        if (pin === savedPin) {
            isVaultMode = true;
            document.body.classList.add('vault-mode');
            document.querySelector('.vault-btn').innerHTML = '<i class="fa-solid fa-unlock"></i> Exit Vault';
            document.getElementById('mode-subtitle').innerText = '🔴 TOP SECRET VAULT ACTIVE';
            fetchNotes();
            Swal.fire({ icon: 'success', title: 'Vault Unlocked', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        } else if (pin) {
            Swal.fire({ icon: 'error', title: 'Access Denied', text: 'Incorrect Password', background: 'rgba(15,23,42,0.97)', color: '#F8FAFC' });
        }
    }
}
