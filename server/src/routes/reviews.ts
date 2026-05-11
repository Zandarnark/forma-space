import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { protect, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({ orderBy: { id: 'desc' } });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: parseInt(req.params.productId) },
      orderBy: { id: 'desc' },
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/', protect, adminOnly, async (req: Request, res: Response) => {
  try {
    const review = await prisma.review.create({ data: req.body });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.put('/:id', protect, adminOnly, async (req: Request, res: Response) => {
  try {
    const review = await prisma.review.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(review);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/:id', protect, adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.review.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Отзыв удалён' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
