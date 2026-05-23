const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const https = require("https");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/clubdb';
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
  enrollment: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  branch: { type: String },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  mobileVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  otp: { code: String, expiresAt: Date },
  clubs: [{ clubId: String, clubName: String, joinedAt: Date }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Notice schema for club updates/programs
const noticeSchema = new mongoose.Schema({
  clubId: { type: String, required: true },
  clubName: { type: String },
  title: { type: String, required: true },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Notice = mongoose.model('Notice', noticeSchema);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { enrollment, name, branch, email, mobile, password, clubId, clubName } = req.body;
    if (!enrollment || !name || !email || !mobile || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await User.findOne({ $or: [{ enrollment }, { email }, { mobile }] });
    if (existing) return res.status(400).json({ error: 'User with same enrollment/email/mobile already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const clubs = [];
  if (clubId) clubs.push({ clubId, clubName: clubName || 'Unknown', joinedAt: new Date() });
  const user = new User({ enrollment, name, branch, email, mobile, passwordHash, otp: { code: otpCode, expiresAt }, clubs });
    await user.save();

    // For demo purposes we print OTP to console. Integrate SMS/email provider in production.
    console.log(`OTP for ${mobile}: ${otpCode}`);

    return res.json({ ok: true, message: 'Registered. OTP sent to mobile (console in demo).' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// simple auth middleware to attach user to request (expects Authorization: Bearer <token>)
async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format' });
    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId).select('-passwordHash -otp');
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
  return next();
}

// join a club (requires auth)
app.post('/api/join-club', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const { clubId, clubName } = req.body;
    if (!clubId) return res.status(400).json({ error: 'Missing clubId' });

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // avoid duplicates
    if (!user.clubs.some(c => c.clubId === clubId)) {
      user.clubs.push({ clubId, clubName: clubName || 'Unknown', joinedAt: new Date() });
      await user.save();
    }
    return res.json({ ok: true, clubs: user.clubs });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// create a notice (for admin/testing) - in real app add auth
// create a notice (admin only)
app.post('/api/notices', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { clubId, clubName, title, message } = req.body;
    if (!clubId || !title) return res.status(400).json({ error: 'Missing fields' });
    const notice = new Notice({ clubId, clubName, title, message });
    await notice.save();
    return res.json({ ok: true, notice });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// update a notice (for demo purposes this endpoint is public; protect with auth in production)
app.put('/api/notices/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, clubId, clubName } = req.body;
    if (!title) return res.status(400).json({ error: 'Missing title' });
    const notice = await Notice.findByIdAndUpdate(id, { title, message, clubId, clubName }, { new: true });
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    return res.json({ ok: true, notice });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// delete a notice (for demo purposes this endpoint is public; protect with auth in production)
app.delete('/api/notices/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByIdAndDelete(id);
    if (!notice) return res.status(404).json({ error: 'Notice not found' });
    return res.json({ ok: true, message: 'Deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// get notices (optionally filter by clubId)
app.get('/api/notices', async (req, res) => {
  try {
    const { clubId } = req.query;
    const filter = clubId ? { clubId } : {};
    const notices = await Notice.find(filter).sort({ createdAt: -1 }).limit(50);
    return res.json({ ok: true, notices });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { enrollment, otp } = req.body;
    if (!enrollment || !otp) return res.status(400).json({ error: 'Missing enrollment or otp' });

    const user = await User.findOne({ enrollment });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.otp || !user.otp.code) return res.status(400).json({ error: 'No OTP found for user' });
    if (new Date() > user.otp.expiresAt) return res.status(400).json({ error: 'OTP expired' });
    if (user.otp.code !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    user.mobileVerified = true;
    user.otp = { code: null, expiresAt: null };
    await user.save();

    // create JWT so user is effectively logged in after verification
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // send back sanitized user info (include role so client can show admin UI)
    const safeUser = {
      enrollment: user.enrollment,
      name: user.name,
      branch: user.branch,
      email: user.email,
      mobile: user.mobile,
      mobileVerified: user.mobileVerified,
      role: user.role || 'user'
    };

    return res.json({ ok: true, message: 'Mobile verified', token, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { enrollment, password } = req.body;
    if (!enrollment || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await User.findOne({ enrollment });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });

    if (!user.mobileVerified) return res.status(403).json({ error: 'Mobile not verified' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ ok: true, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Protected route
app.get('/api/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format' });

    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId).select('-passwordHash -otp');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // fetch notices relevant to user's clubs
    const clubIds = (user.clubs || []).map(c => c.clubId);
    const notices = clubIds.length ? await Notice.find({ clubId: { $in: clubIds } }).sort({ createdAt: -1 }).limit(50) : [];

    return res.json({ ok: true, user, notices });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// Serve testing.html at root (so visiting / shows the page with the modal)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/testing', (req, res) => {
  res.sendFile(path.join(__dirname, 'testing2.html'));
});



// Serve static files (frontend)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
//nahi karegi woh kutte jaise terate ache se respect kregi for 