require('dotenv').config();

// Fix for Render: Only use Google DNS bypass locally. Render's Linux network breaks if we force external DNS.
if (!process.env.RENDER) {
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas (DBaaS)'))
  .catch(err => console.error('MongoDB connection error:', err));

const noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  category: { type: String, default: 'General' }, // NEW: Category Tagging
  isSecret: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', noteSchema);

// --- REST APIs ---

// GET: Fetch notes
app.get('/api/notes', async (req, res) => {
  try {
    const isSecretReq = req.query.secret === 'true';
    const notes = await Note.find({ isSecret: isSecretReq }).sort({ createdAt: -1 });
    return res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Database connection failed' });
  }
});

// POST: Add a new note
app.post('/api/notes', async (req, res) => {
  const note = new Note({
    title: req.body.title,
    content: req.body.content,
    category: req.body.category || 'General',
    isSecret: req.body.isSecret || false
  });
  try {
    const newNote = await note.save();
    res.status(201).json(newNote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT: Edit Note 
app.put('/api/notes/:id', async (req, res) => {
  try {
    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        content: req.body.content,
        category: req.body.category
      },
      { new: true }
    );
    res.json(updatedNote);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT: Toggle Secret Status
app.put('/api/notes/:id/toggle-secret', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.isSecret = !note.isSecret;
    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE: Remove a note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
