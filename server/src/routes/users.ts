import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { protect, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', protect, adminOnly, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, email: true, name: true, role: true, avatar: true, phone: true, createdAt: true },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/', protect, adminOnly, async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const user = await prisma.user.create({
      data: { email, passwordHash: hashedPassword, name, role: role || 'user' },
    });
    const { passwordHash, ...safe } = user;
    res.status(201).json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.put('/:id', protect, adminOnly, async (req: Request, res: Response) => {
  const data: any = { ...req.body };
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.delete('/:id', protect, adminOnly, async (req: Request, res: Response) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ message: 'Нельзя удалить себя' });
    return;
  }
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
