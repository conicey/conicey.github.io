import crypto from 'crypto';

export default async function handler(req, res) {

  // only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  // generate giant token
  const token = crypto
    .randomBytes(96)
    .toString('base64url');

  console.log('Generated token:', token);

  return res.status(200).json({
    success: true
  });
}
