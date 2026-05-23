import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();
app.use(cors());
app.use(express.json());

/* 🔗 CONNECT MONGODB */
mongoose.connect('mongodb+srv://ayushmandal533_db_user:<db_password>@cluster0.lzfundx.mongodb.net/?appName=Cluster0')
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));
/* 📦 SCHEMA */
const noticeSchema = new mongoose.Schema({
    title: String,
    club: String,
    content: String,
    priority: String,
    status: String,
    createdAt: String
});

const Notice = mongoose.model('Notice', noticeSchema);

/* 📥 GET ALL NOTICES */
app.get('/', (req, res) => {
    res.send("Backend is running 🚀");
});

app.get('/api/notices', async (req, res) => {
    const notices = await Notice.find().sort({ _id: -1 });
    res.json(notices);
});

/* 📤 POST NOTICE */
app.post('/api/notices', async (req, res) => {
    const notice = new Notice(req.body);
    await notice.save();
    res.json({ message: "Saved to DB ✅", id: notice._id });
});

/* 🗑️ DELETE NOTICE */
app.delete('/api/notices/:id', async (req, res) => {
    try {
        const result = await Notice.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ message: "Notice not found ❌" });
        }
        res.json({ message: "Notice deleted ✅" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting notice ❌", error: err.message });
    }
});

/* 🚀 SERVER */
app.listen(3000, () => {
    console.log("Server running on http://localhost:4600");
});