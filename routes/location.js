const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { db, FieldValue } = require('../firebase/admin');

// POST /api/v1/location/save
router.post('/save', requireAuth, async (req, res) => {
  try {
    const { state, city, lga, area, latitude, longitude, detectedLabel, manualLabel } = req.body;
    await db().collection('users').doc(req.user.uid).update({
      state: state || '', city: city || '', lga: lga || '', area: area || '',
      latitude: latitude || null, longitude: longitude || null,
      detectedLocationLabel: detectedLabel || '',
      manualLocationLabel: manualLabel || '',
      savedLocationUpdatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({ success: true, message: 'Location saved' });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to save location' });
  }
});

module.exports = router;
