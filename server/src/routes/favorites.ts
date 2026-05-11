import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const favs = await prisma.favorite.findMany({ where: { userId: req.user!.id } });
    res.json(favs.map((f) => f.productId));
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/:productId', protect, async (req: Request, res: Response) => {
  try {
    await prisma.favorite.upsert({
      where: { userId_productId: { userId: req.user!.id, productId: parseInt(req.params.productId) } },
      update: {},
      create: { userId: req.user!.id, productId: parseInt(req.params.productId) },
    });
    res.json({ message: 'Добавлено' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/:productId', protect, async (req: Request, res: Response) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user!.id, productId: parseInt(req.params.productId) },
    });
    res.json({ message: 'Удалено' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
