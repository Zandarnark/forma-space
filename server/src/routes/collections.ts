import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const cols = await prisma.collection.findMany({
      where: { userId: req.user!.id },
      include: { items: { select: { productId: true } } },
    });
    res.json(cols.map((c) => ({ id: c.id, name: c.name, items: c.items.map((i) => i.productId) })));
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/', protect, async (req: Request, res: Response) => {
  const { name } = req.body;
  try {
    const col = await prisma.collection.create({
      data: { userId: req.user!.id, name },
    });
    res.status(201).json({ id: col.id, name: col.name, items: [] });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/:id', protect, async (req: Request, res: Response) => {
  try {
    const col = await prisma.collection.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user!.id },
    });
    if (!col) {
      res.status(404).json({ message: 'Коллекция не найдена' });
      return;
    }
    await prisma.collection.delete({ where: { id: col.id } });
    res.json({ message: 'Удалено' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/:id/add', protect, async (req: Request, res: Response) => {
  const { productId } = req.body;
  try {
    await prisma.collectionItem.upsert({
      where: { collectionId_productId: { collectionId: parseInt(req.params.id), productId } },
      update: {},
      create: { collectionId: parseInt(req.params.id), productId },
    });
    res.json({ message: 'Добавлено' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/:id/remove', protect, async (req: Request, res: Response) => {
  const { productId } = req.body;
  try {
    await prisma.collectionItem.deleteMany({
      where: { collectionId: parseInt(req.params.id), productId },
    });
    res.json({ message: 'Удалено' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
