import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';

import authRouter from './routes/auth';
import productsRouter from './routes/products';
import cartRouter from './routes/cart';
import favoritesRouter from './routes/favorites';
import collectionsRouter from './routes/collections';
import ordersRouter from './routes/orders';
import reviewsRouter from './routes/reviews';
import uploadRouter from './routes/upload';
import usersRouter from './routes/users';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`FORMA SPACE API → http://localhost:${PORT}`);
});
