import { Router, Request, Response } from 'express';
import { protect, adminOnly } from '../middleware/auth';
import { uploadSingle, uploadMultiple } from '../middleware/upload';

const router = Router();

router.post('/single', protect, uploadSingle, (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'Файл не загружен' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

router.post('/avatar', protect, uploadSingle, (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'Файл не загружен' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

router.post('/multiple', protect, adminOnly, uploadMultiple, (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({ message: 'Файлы не загружены' });
    return;
  }
  res.json({ urls: files.map((f) => `/uploads/${f.filename}`) });
});

export default router;
