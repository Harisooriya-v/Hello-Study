import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'free-secret');
        const storageKey = `data:${decoded.uid}:scribbles`;
        let sketches = await kv.get(storageKey) || [];

        if (req.method === 'GET') return res.status(200).json(sketches);

        if (req.method === 'POST') {
            let finalImageUrl = null;

            if (req.body.imageUrl && req.body.imageUrl.startsWith('data:')) {
                const base64Data = req.body.imageUrl.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `sketch_${Date.now()}.png`;

                const blob = await put(filename, buffer, { access: 'public', contentType: 'image/png' });
                finalImageUrl = blob.url;
            }

            const newSketch = { id: 'sketch_' + Date.now(), imageUrl: finalImageUrl, createdAt: new Date().toISOString() };
            sketches.unshift(newSketch);
            await kv.set(storageKey, sketches);
            return res.status(201).json(newSketch);
        }

        if (req.method === 'DELETE') {
            const targetId = req.url.split('/').pop();
            sketches = sketches.filter(s => s.id !== targetId);
            await kv.set(storageKey, sketches);
            return res.status(200).json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}