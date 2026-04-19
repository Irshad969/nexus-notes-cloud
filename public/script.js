const API_URL = '/api/notes';
let isVaultMode = false;

// Voice Dictation State
let recognition;
let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
    fetchNotes();
    initSpeechRecognition();
});

function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = function(event) {
            let final_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                }
            }
            if(final_transcript) {
                const contentBox = document.getElementById('note-content');
                contentBox.value += (contentBox.value.endsWith(' ') || !contentBox.value ? '' : ' ') + final_transcript;
                updateCharCount();
            }
        };

        recognition.onerror = function(event) { console.error("Speech Error", event); stopDictation(); }
        recognition.onend = function() { stopDictation(); }
    }
}

function toggleDictation() {
    if (!recognition) return Swal.fire('Not Supported', 'Your browser does not support Voice Dictation.', 'error');
    if (isRecording) { stopDictation(); }
    else {
        document.getElementById('mic-btn').classList.add('recording');
        recognition.start();
        isRecording = true;
        Swal.fire({ title: 'Listening...', text: 'Speak your note into the microphone.', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    }
}

function stopDictation() {
    if (recognition) recognition.stop();
    document.getElementById('mic-btn').classList.remove('recording');
    isRecording = false;
}

function readAloudNote(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // stop previous
        const speech = new SpeechSynthesisUtterance(text);
        speech.rate = 1;
        speech.pitch = 1;
        window.speechSynthesis.speak(speech);
        Swal.fire({ title: 'Reading Note...', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    }
}

function updateCharCount() {
    const text = document.getElementById('note-content').value;
    document.getElementById('char-count').innerText = `${text.length} characters`;
}

function filterNotes() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const cards = document.querySelectorAll('.note-card');
    cards.forEach(card => {
        const title = card.querySelector('h3').innerText.toLowerCase();
        const content = card.querySelector('p').innerText.toLowerCase();
        const cat = card.querySelector('.category-badge').innerText.toLowerCase();
        if (title.includes(query) || content.includes(query) || cat.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

async function fetchNotes() {
    try {
        let url = API_URL;
        if (isVaultMode) {
            url += `?secret=true`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Database Error');
        const notes = await response.json();
        displayNotes(notes);
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Could not connect to Database.' });
    }
}

function displayNotes(notes) {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';

    if (notes.length === 0) {
        notesList.innerHTML = `<div style="color: #64748B; text-align: center; grid-column: 1/-1; padding: 4rem; display: flex; flex-direction: column; align-items: center; gap: 15px;">
            <i class="fa-solid fa-folder-open" style="font-size: 3rem; opacity: 0.5;"></i>
            <p>No ${isVaultMode ? 'secret ' : ''}records found.</p>
        </div>`;
        return;
    }

    notes.forEach((note, index) => {
        const noteEl = document.createElement('div');
        noteEl.classList.add('note-card');
        noteEl.style.animationDelay = `${index * 0.05}s`;
        
        const dateObj = new Date(note.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        const catClass = `cat-${(note.category || 'General').toLowerCase()}`;

        noteEl.innerHTML = `
            <div class="category-badge ${catClass}">${note.category || 'General'}</div>
            <h3>${note.title}</h3>
            
            <div class="note-date">
                <i class="fa-regular fa-clock"></i> ${dateStr} 
                ${isVaultMode ? '<i class="fa-solid fa-lock" style="color:#EF4444; margin-left:5px;"></i>' : ''}
                <div class="util-btns">
                    <button onclick="readAloudNote(\`${note.content.replace(/`/g, '\\`')}\`)" title="Read Aloud (TTS)"><i class="fa-solid fa-volume-up"></i></button>
                    <button onclick="copyNoteContent(this, \`${note.content.replace(/`/g, '\\`')}\`)" title="Copy Content"><i class="fa-solid fa-copy"></i></button>
                    <button onclick="downloadNote(\`${note.title.replace(/`/g, '\\`')}\`, \`${note.content.replace(/`/g, '\\`')}\`)" title="Download as TXT"><i class="fa-solid fa-download"></i></button>
                </div>
            </div>
            
            <p>${note.content}</p>
            
            <div class="card-actions">
                <button class="toggle-secret-btn" onclick="toggleSecretStatus('${note._id}', ${note.isSecret})">
                    ${isVaultMode ? '<i class="fa-solid fa-eye"></i> Unhide' : '<i class="fa-solid fa-eye-slash"></i> Hide'}
                </button>
                <button class="edit-btn" onclick="editNote('${note._id}', \`${note.title.replace(/`/g, '\\`')}\`, \`${note.content.replace(/`/g, '\\`')}\`, '${note.category || 'General'}')">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="delete-btn" onclick="deleteNote('${note._id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        notesList.appendChild(noteEl);
    });
}

function copyNoteContent(btn, content) {
    navigator.clipboard.writeText(content).then(() => {
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color:#34D399;"></i>';
        setTimeout(() => btn.innerHTML = originalIcon, 2000);
    });
}

function downloadNote(title, content) {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

async function exportAllNotes() {
    try {
        let url = API_URL;
        if (isVaultMode) url += `?secret=true`;
        const response = await fetch(url);
        const notes = await response.json();
        
        if(notes.length === 0) return Swal.fire({icon: 'info', title: 'Empty', text: 'No notes to export'});
        
        let exportData = "--- NEXUS NOTES EXPORT ---\n\n";
        notes.forEach(n => {
            exportData += `Title: ${n.title}\nCategory: ${n.category || 'General'}\nDate: ${new Date(n.createdAt).toLocaleString()}\n\n${n.content}\n\n---------------------------\n\n`;
        });
        
        downloadNote(`NexusNotes_Export_${new Date().getTime()}`, exportData);
        Swal.fire({icon: 'success', title: 'Exported Successfully', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false});
    } catch(e) { console.error(e); }
}

async function saveNote() {
    const id = document.getElementById('edit-id').value;
    const titleInput = document.getElementById('note-title');
    const contentInput = document.getElementById('note-content');
    const categoryInput = document.getElementById('note-category');
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const category = categoryInput.value;

    if (!title || !content) return Swal.fire({ icon: 'warning', title: 'Empty Fields' });

    const btn = document.getElementById('save-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
    btn.disabled = true;

    try {
        let url = API_URL;
        let method = 'POST';
        let bodyData = { title, content, category, isSecret: isVaultMode };

        if (id) {
            url = `${API_URL}/${id}`;
            method = 'PUT';
            bodyData = { title, content, category }; 
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        if (response.ok) {
            cancelEdit();
            Swal.fire({ icon: 'success', title: id ? 'Updated!' : 'Saved!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            fetchNotes();
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-paper-plane"></i> Initialize Record';
    document.getElementById('cancel-btn').style.display = 'none';
    updateCharCount();
}

function deleteNote(id) {
    Swal.fire({
        title: 'Delete Record?', icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Yes, delete!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
            fetchNotes();
        }
    });
}

async function toggleSecretStatus(id, isSecretCurrently) {
    if (!isSecretCurrently && !localStorage.getItem('vaultPin')) {
        Swal.fire({
            icon: 'info', title: 'Vault Not Setup', 
            text: 'Please setup your Vault Password first by clicking "Hidden Vault" at the top before you can hide notes.'
        });
        return;
    }

    const action = isSecretCurrently ? 'Unhide' : 'Hide';
    const text = isSecretCurrently ? 'move this note back to public?' : 'move this note into the secret Vault?';

    const result = await Swal.fire({
        title: `${action} Note?`, text: text, icon: 'question', showCancelButton: true,
        confirmButtonText: `Yes, ${action}`
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`${API_URL}/${id}/toggle-secret`, { method: 'PUT' });
            if (response.ok) {
                Swal.fire({ icon: 'success', title: isSecretCurrently ? 'Unhidden!' : 'Hidden!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                fetchNotes();
            }
        } catch (error) {
            console.error('Error toggling secret:', error);
        }
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
            const { value: newPin } = await Swal.fire({
                title: 'Create Vault Password',
                text: 'Set a password to lock your secret notes.',
                input: 'password',
                confirmButtonText: 'Save Password'
            });

            if (newPin) {
                localStorage.setItem('vaultPin', newPin);
                savedPin = newPin;
                Swal.fire({ icon: 'success', title: 'Password Saved!', text: 'Your vault is now secure.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            } else {
                return; 
            }
        }

        const { value: pin } = await Swal.fire({
            title: 'Enter Vault Password',
            input: 'password',
            confirmButtonText: 'Unlock Vault'
        });

        if (pin === savedPin) {
            isVaultMode = true;
            document.body.classList.add('vault-mode');
            document.querySelector('.vault-btn').innerHTML = '<i class="fa-solid fa-unlock"></i> Exit Vault';
            document.getElementById('mode-subtitle').innerText = '🔴 TOP SECRET VAULT ACTIVE';
            fetchNotes();
            Swal.fire({ icon: 'success', title: 'Vault Unlocked', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        } else if (pin) {
            Swal.fire({ icon: 'error', title: 'Access Denied', text: 'Incorrect Password' });
        }
    }
}
