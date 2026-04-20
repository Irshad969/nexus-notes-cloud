require('dotenv').config();

if (!process.env.RENDER) {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const helmet    = require('helmet');
const path      = require('path');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT       = process.env.PORT || 5000;

// =====================
// SUPABASE SETUP
// =====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas (DBaaS)'))
  .catch(err => console.error('MongoDB connection error:', err));

// =====================
// SCHEMAS & MODELS
// =====================

const noteSchema = new mongoose.Schema({
  userId:    { type: String, required: true }, // Changed to String for Supabase UUID
  title:     String,
  content:   String,
  category:  { type: String, default: 'General' },
  isSecret:  { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);

// =====================
// HELPERS
// =====================

async function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. Please log in.' });
  
  try {
    // Verify token with Supabase directly
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ message: 'Invalid or expired session. Please log in again.' });
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch {
    res.status(403).json({ message: 'Server error verifying session.' });
  }
}

// NOTE: All authentication (login, register, email verification) is now handled 
// directly on the frontend by the @supabase/supabase-js library.

// =====================
// NOTES ROUTES (Protected)
// =====================

app.get('/api/notes', authMiddleware, async (req, res) => {
  try {
    const isSecretReq = req.query.secret === 'true';
    const notes = await Note.find({ userId: req.user.id, isSecret: isSecretReq }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Database connection failed' });
  }
});

app.post('/api/notes', authMiddleware, async (req, res) => {
  const note = new Note({
    userId:   req.user.id,
    title:    req.body.title,
    content:  req.body.content,
    category: req.body.category || 'General',
    isSecret: req.body.isSecret || false
  });
  try {
    res.status(201).json(await note.save());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found or access denied.' });
    note.title = req.body.title; note.content = req.body.content; note.category = req.body.category;
    res.json(await note.save());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/notes/:id/toggle-secret', authMiddleware, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found or access denied.' });
    note.isSecret = !note.isSecret;
    res.json(await note.save());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const result = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!result) return res.status(404).json({ message: 'Note not found or access denied.' });
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
