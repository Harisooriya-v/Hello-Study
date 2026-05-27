import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    const { email, pass } = req.body;

    try {
        const user = await kv.get(`auth:user:${email.toLowerCase()}`);
        if (!user) return res.status(400).json({ message: 'Invalid email or password.' });

        const match = await bcrypt.compare(pass, user.pass);
        if (!match) return res.status(400).json({ message: 'Invalid email or password.' });

        const token = jwt.sign({ uid: user.uid, email: user.email }, process.env.JWT_SECRET || 'free-secret', { expiresIn: '30d' });
        return res.status(200).json({ uid: user.uid, email: user.email, token });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}