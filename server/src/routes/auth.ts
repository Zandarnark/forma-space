import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { protect } from '../middleware/auth';

const router = Router();

const generateToken = (id: string, role: string): string => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
};

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ message: 'Заполните все поля' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: 'Пользователь уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        collections: { create: { name: 'Гостиная' } },
      },
    });

    const token = generateToken(user.id, user.role);
    const { passwordHash, ...safe } = user;
    res.status(201).json({ token, user: safe });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { cart: true, favorites: true, collections: { include: { items: true } } },
    });
    if (!user) {
      res.status(400).json({ message: 'Неверный email или пароль' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: 'Неверный email или пароль' });
      return;
    }

    const token = generateToken(user.id, user.role);
    const { passwordHash, ...safe } = user;
    res.json({ token, user: safe });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.get('/me', protect, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { cart: true, favorites: true, collections: { include: { items: true } } },
    });
    if (!user) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.put('/me', protect, async (req: Request, res: Response) => {
  const { name, phone } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, phone },
    });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

router.put('/me/avatar', protect, async (req: Request, res: Response) => {
  const { avatar } = req.body;
  if (!avatar) {
    res.status(400).json({ message: 'Аватар обязателен' });
    return;
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar },
    });
    const { passwordHash, ...safe } = user;
    res.json(safe);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера', error });
  }
});

export default router;
