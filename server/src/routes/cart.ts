import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/', protect, async (req: Request, res: Response) => {
  const { productId, qty } = req.body;
  try {
    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId } },
    });
    let item;
    if (existing) {
      item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { qty: qty || existing.qty + 1 },
      });
    } else {
      item = await prisma.cartItem.create({
        data: { userId: req.user!.id, productId, qty: qty || 1 },
      });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.put('/:productId', protect, async (req: Request, res: Response) => {
  const { qty } = req.body;
  const productId = parseInt(req.params.productId);
  try {
    if (qty <= 0) {
      await prisma.cartItem.deleteMany({ where: { userId: req.user!.id, productId } });
      res.json({ message: 'Удалено' });
      return;
    }
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      update: { qty },
      create: { userId: req.user!.id, productId, qty },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/:productId', protect, async (req: Request, res: Response) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.user!.id, productId: parseInt(req.params.productId) },
    });
    res.json({ message: 'Удалено' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/', protect, async (req: Request, res: Response) => {
  try {
    await prisma.cartItem.deleteMany({ where: { userId: req.user!.id } });
    res.json({ message: 'Корзина очищена' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
