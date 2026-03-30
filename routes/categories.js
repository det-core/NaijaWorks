const express = require('express');
const router  = express.Router();
const { db } = require('../firebase/admin');

// Public endpoint - returns all active categories
router.get('/', async (req, res) => {
  try {
    const snap = await db().collection('categories').where('active','==',true).get();
    const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, categories });
  } catch(e) {
    // Fallback to config categories if Firestore empty
    return res.json({ success: true, categories: [] });
  }
});

module.exports = router;
