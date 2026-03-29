// ============================================================
// NaijaWorks — VIP Controller
// ============================================================
const { db, FieldValue } = require('../firebase/admin');
const paystackService = require('../services/paystackService');
const config = require('../config/config');
const { nairaToKobo } = require('../utils/commission');

async function initVIPPayment(req, res) {
  try {
    const uid = req.user.uid;
    const userDoc = await db().collection('users').doc(uid).get();
    const user = userDoc.data();

    const amountNaira = config.platform.vip.weeklyPriceNaira;
    const reference   = paystackService.generateReference('NW-VIP');

    const paystackRes = await paystackService.initializeTransaction({
      email: user.email,
      amountKobo: nairaToKobo(amountNaira),
      reference,
      metadata: {
        workerId: uid,
        type: 'vip_subscription',
        custom_fields: [{ display_name: 'Plan', variable_name: 'plan', value: 'NaijaWorks VIP Weekly' }],
      },
    });

    if (!paystackRes.status) {
      return res.status(502).json({ success: false, message: 'Payment initialization failed' });
    }

    await paystackService.savePaymentRecord({
      uid, relatedType: 'vip', relatedId: uid,
      provider: 'paystack', amountNaira, reference, status: 'pending',
    });

    return res.json({ success: true, authorizationUrl: paystackRes.data.authorization_url, reference });
  } catch(e) {
    console.error('[VIP/Init]', e);
    return res.status(500).json({ success: false, message: e.message || 'VIP payment failed' });
  }
}

async function getVIPStatus(req, res) {
  try {
    const doc = await db().collection('users').doc(req.user.uid).get();
    const user = doc.data();
    const now  = new Date();
    const end  = user.vipEndDate?.toDate ? user.vipEndDate.toDate() : user.vipEndDate ? new Date(user.vipEndDate) : null;
    const isActive = user.isVIP && end && end > now;
    return res.json({ success: true, isVIP: isActive, vipEndDate: end, commissionRate: user.commissionRate });
  } catch(e) {
    return res.status(500).json({ success: false, message: 'Failed to get VIP status' });
  }
}

module.exports = { initVIPPayment, getVIPStatus };
