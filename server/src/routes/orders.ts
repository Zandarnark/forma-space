import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { protect, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', protect, adminOnly, async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { id: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.get('/my', protect, async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { items: true },
      orderBy: { id: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/', protect, async (req: Request, res: Response) => {
  const { total, promo, deliveryMethod, city, street, phone, pickupAddress } = req.body;
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
    });
    if (cartItems.length === 0) {
      res.status(400).json({ message: 'Корзина пуста' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    const order = await prisma.order.create({
      data: {
        userId: req.user!.id,
        userName: user!.name,
        total,
        promo: promo || '',
        deliveryMethod: deliveryMethod || 'courier',
        city: city || '',
        street: street || '',
        phone: phone || '',
        pickupAddress: pickupAddress || '',
        items: {
          create: cartItems.map((ci) => ({
            productId: ci.productId,
            name: ci.product.name,
            qty: ci.qty,
            price: ci.product.price,
          })),
        },
      },
      include: { items: true },
    });

    await prisma.cartItem.deleteMany({ where: { userId: req.user!.id } });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.put('/:id/status', protect, adminOnly, async (req: Request, res: Response) => {
  const { status } = req.body;
  try {
    const order = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status },
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/:id', protect, adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.order.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Заказ удалён' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
