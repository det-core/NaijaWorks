const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs-extra');
const { requireAuth } = require('../middleware/auth');
const { db, FieldValue } = require('../firebase/admin');
const config   = require('../config/config');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(config.uploads.directory, req.user.uid);
    await fs.ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [...config.uploads.allowedImageTypes, ...config.uploads.allowedDocTypes];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('File type not allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: config.uploads.maxFileSizeBytes } });

router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `/uploads/${req.user.uid}/${req.file.filename}`;
    await db().collection('users').doc(req.user.uid).update({ profilePhoto: url, updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, url });
  } catch(e) { return res.status(500).json({ success: false, message: e.message }); }
});

router.post('/portfolio', requireAuth, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files' });
    const urls = req.files.map(f => `/uploads/${req.user.uid}/${f.filename}`);
    await db().collection('users').doc(req.user.uid).update({ portfolioImages: FieldValue.arrayUnion(...urls), updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, urls });
  } catch(e) { return res.status(500).json({ success: false, message: e.message }); }
});

router.post('/job-evidence', requireAuth, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files' });
    const { contractId } = req.body;
    const urls = req.files.map(f => `/uploads/${req.user.uid}/${f.filename}`);
    if (contractId) await db().collection('contracts').doc(contractId).update({ completionEvidence: FieldValue.arrayUnion(...urls), updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, urls });
  } catch(e) { return res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
