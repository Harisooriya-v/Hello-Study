import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    const { email, pass } = req.body;
    if (!email || !pass) return res.status(400).json({ message: 'Missing fields' });

    try {
        const userKey = `auth:user:${email.toLowerCase()}`;
        const existingUser = await kv.get(userKey);
        if (existingUser) return res.status(400).json({ message: 'Account already exists.' });

        const uid = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash(pass, 10);

        // Store user in free Redis database
        await kv.set(userKey, { uid, email: email.toLowerCase(), pass: hashedPassword });

        const token = jwt.sign({ uid, email }, process.env.JWT_SECRET || 'free-secret', { expiresIn: '30d' });
        return res.status(201).json({ uid, email, token });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}