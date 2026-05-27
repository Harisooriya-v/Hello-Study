import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'free-secret');
        const storageKey = `data:${decoded.uid}:checklists`;
        let items = await kv.get(storageKey) || [];

        if (req.method === 'GET') {
            return res.status(200).json(items);
        }

        if (req.method === 'POST') {
            const newItem = { id: 'item_' + Date.now(), title: req.body.title, notes: req.body.notes, isCompleted: false };
            items.unshift(newItem);
            await kv.set(storageKey, items);
            return res.status(201).json(newItem);
        }

        // Handle path variations matching URL structures from app.js
        const targetId = req.url.split('/').pop();
        if (req.method === 'PATCH') {
            items = items.map(i => i.id === targetId ? { ...i, isCompleted: req.body.isCompleted } : i);
            await kv.set(storageKey, items);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            items = items.filter(i => i.id !== targetId);
            await kv.set(storageKey, items);
            return res.status(200).json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}