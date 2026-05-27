import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'free-secret');
        const storageKey = `data:${decoded.uid}:notes`;
        let notes = await kv.get(storageKey) || [];

        if (req.method === 'GET') return res.status(200).json(notes);

        if (req.method === 'POST') {
            let finalImageUrl = null;

            // Stream image files safely to Blob storage, saving your Redis memory!
            if (req.body.imageUrl && req.body.imageUrl.startsWith('data:')) {
                const base64Data = req.body.imageUrl.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `note_${Date.now()}.jpg`;

                const blob = await put(filename, buffer, { access: 'public', contentType: 'image/jpeg' });
                finalImageUrl = blob.url;
            }

            const newNote = { 
                id: 'note_' + Date.now(), 
                content: req.body.content || '', 
                imageUrl: finalImageUrl, 
                createdAt: new Date().toISOString() 
            };
            notes.unshift(newNote);
            await kv.set(storageKey, notes);
            return res.status(201).json(newNote);
        }

        if (req.method === 'DELETE') {
            const targetId = req.url.split('/').pop();
            notes = notes.filter(n => n.id !== targetId);
            await kv.set(storageKey, notes);
            return res.status(200).json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}