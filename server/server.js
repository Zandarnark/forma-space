import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import process from 'node:process'

const prisma = new PrismaClient()
const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const JWT_SECRET = process.env.JWT_SECRET || 'forma-space-secret-change-in-production'

function auth(req, res, next) {
  const h = req.headers.authorization
  if (!h) return res.status(401).json({ error: 'Не авторизован' })
  try {
    const token = h.split(' ')[1]
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch { res.status(401).json({ error: 'Неверный токен' }) }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещен' })
  next()
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

function sanitizeUser(user) {
  const safe = { ...user }
  delete safe.passwordHash
  return safe
}

// ========== AUTH ==========

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Неверный email или пароль' })
  }
  const safe = sanitizeUser(user)
  res.json({ user: safe, token: signToken(user) })
})

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Заполните все поля' })
  if (await prisma.user.findUnique({ where: { email } })) return res.status(400).json({ error: 'Пользователь уже существует' })
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { email, passwordHash: hashed, name, collections: { create: { name: 'Гостиная' } } } })
  const safe = sanitizeUser(user)
  res.json({ user: safe, token: signToken(user) })
})

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { cart: { include: { product: true } }, favorites: true, collections: { include: { items: true } } }
  })
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' })
  const safe = sanitizeUser(user)
  res.json(safe)
})

// ========== PRODUCTS ==========

app.get('/api/products', async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: 'asc' } })
  res.json(products)
})

app.get('/api/products/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: +req.params.id } })
  if (!p) return res.status(404).json({ error: 'Не найден' })
  res.json(p)
})

app.post('/api/products', auth, adminOnly, async (req, res) => {
  const p = await prisma.product.create({ data: req.body })
  res.json(p)
})

app.put('/api/products/:id', auth, adminOnly, async (req, res) => {
  const p = await prisma.product.update({ where: { id: +req.params.id }, data: req.body })
  res.json(p)
})

app.delete('/api/products/:id', auth, adminOnly, async (req, res) => {
  await prisma.product.delete({ where: { id: +req.params.id } })
  res.json({ ok: true })
})

// ========== CART ==========

app.get('/api/cart', auth, async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: true }
  })
  res.json(items)
})

app.post('/api/cart', auth, async (req, res) => {
  const { productId, qty } = req.body
  const existing = await prisma.cartItem.findUnique({ where: { userId_productId: { userId: req.user.id, productId } } })
  let item
  if (existing) {
    item = await prisma.cartItem.update({ where: { id: existing.id }, data: { qty: qty || existing.qty + 1 } })
  } else {
    item = await prisma.cartItem.create({ data: { userId: req.user.id, productId, qty: qty || 1 } })
  }
  res.json(item)
})

app.put('/api/cart/:productId', auth, async (req, res) => {
  const { qty } = req.body
  if (qty <= 0) {
    await prisma.cartItem.deleteMany({ where: { userId: req.user.id, productId: +req.params.productId } })
    return res.json({ ok: true })
  }
  const item = await prisma.cartItem.upsert({
    where: { userId_productId: { userId: req.user.id, productId: +req.params.productId } },
    update: { qty },
    create: { userId: req.user.id, productId: +req.params.productId, qty }
  })
  res.json(item)
})

app.delete('/api/cart/:productId', auth, async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id, productId: +req.params.productId } })
  res.json({ ok: true })
})

app.delete('/api/cart', auth, async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } })
  res.json({ ok: true })
})

// ========== FAVORITES ==========

app.get('/api/favorites', auth, async (req, res) => {
  const favs = await prisma.favorite.findMany({ where: { userId: req.user.id } })
  res.json(favs.map((f) => f.productId))
})

app.post('/api/favorites/:productId', auth, async (req, res) => {
  await prisma.favorite.upsert({
    where: { userId_productId: { userId: req.user.id, productId: +req.params.productId } },
    update: {},
    create: { userId: req.user.id, productId: +req.params.productId }
  })
  res.json({ ok: true })
})

app.delete('/api/favorites/:productId', auth, async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user.id, productId: +req.params.productId } })
  res.json({ ok: true })
})

// ========== COLLECTIONS ==========

app.get('/api/collections', auth, async (req, res) => {
  const cols = await prisma.collection.findMany({
    where: { userId: req.user.id },
    include: { items: { select: { productId: true } } }
  })
  res.json(cols.map((c) => ({ id: c.id, name: c.name, items: c.items.map((i) => i.productId) })))
})

app.post('/api/collections', auth, async (req, res) => {
  const { name } = req.body
  const col = await prisma.collection.create({ data: { userId: req.user.id, name }, include: { items: true } })
  res.json({ id: col.id, name: col.name, items: [] })
})

app.delete('/api/collections/:id', auth, async (req, res) => {
  const col = await prisma.collection.findFirst({ where: { id: +req.params.id, userId: req.user.id } })
  if (!col) return res.status(404).json({ error: 'Не найдена' })
  await prisma.collection.delete({ where: { id: col.id } })
  res.json({ ok: true })
})

app.post('/api/collections/:id/add', auth, async (req, res) => {
  const { productId } = req.body
  await prisma.collectionItem.upsert({
    where: { collectionId_productId: { collectionId: +req.params.id, productId } },
    update: {},
    create: { collectionId: +req.params.id, productId }
  })
  res.json({ ok: true })
})

app.post('/api/collections/:id/remove', auth, async (req, res) => {
  const { productId } = req.body
  await prisma.collectionItem.deleteMany({ where: { collectionId: +req.params.id, productId } })
  res.json({ ok: true })
})

// ========== ORDERS ==========

app.get('/api/orders', auth, adminOnly, async (_req, res) => {
  const orders = await prisma.order.findMany({ include: { items: true }, orderBy: { id: 'desc' } })
  res.json(orders)
})

app.get('/api/orders/my', auth, async (req, res) => {
  const orders = await prisma.order.findMany({ where: { userId: req.user.id }, include: { items: true }, orderBy: { id: 'desc' } })
  res.json(orders)
})

app.post('/api/orders', auth, async (req, res) => {
  const { total, promo, deliveryMethod, city, street, phone, pickupAddress } = req.body
  const cartItems = await prisma.cartItem.findMany({ where: { userId: req.user.id }, include: { product: true } })
  if (cartItems.length === 0) return res.status(400).json({ error: 'Корзина пуста' })
  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  const order = await prisma.order.create({
    data: {
      userId: req.user.id,
      userName: user.name,
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
          price: ci.product.price
        }))
      }
    },
    include: { items: true }
  })
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } })
  res.json(order)
})

app.put('/api/orders/:id/status', auth, adminOnly, async (req, res) => {
  const order = await prisma.order.update({ where: { id: +req.params.id }, data: { status: req.body.status } })
  res.json(order)
})

app.delete('/api/orders/:id', auth, adminOnly, async (req, res) => {
  await prisma.order.delete({ where: { id: +req.params.id } })
  res.json({ ok: true })
})

// ========== REVIEWS ==========

app.get('/api/reviews', async (_req, res) => {
  const reviews = await prisma.review.findMany({ orderBy: { id: 'desc' } })
  res.json(reviews)
})

app.get('/api/reviews/product/:productId', async (req, res) => {
  const reviews = await prisma.review.findMany({ where: { productId: +req.params.productId }, orderBy: { id: 'desc' } })
  res.json(reviews)
})

app.post('/api/reviews', auth, adminOnly, async (req, res) => {
  const review = await prisma.review.create({ data: req.body })
  res.json(review)
})

app.put('/api/reviews/:id', auth, adminOnly, async (req, res) => {
  const review = await prisma.review.update({ where: { id: +req.params.id }, data: req.body })
  res.json(review)
})

app.delete('/api/reviews/:id', auth, adminOnly, async (req, res) => {
  await prisma.review.delete({ where: { id: +req.params.id } })
  res.json({ ok: true })
})

// ========== IMAGES ==========

app.post('/api/images', async (req, res) => {
  const { key, data, productId, userId, reviewId } = req.body
  const img = await prisma.image.upsert({
    where: { key },
    update: { data, productId: productId || null, userId: userId || null, reviewId: reviewId || null },
    create: { key, data, productId: productId || null, userId: userId || null, reviewId: reviewId || null }
  })
  res.json({ key: img.key })
})

app.get('/api/images/:key', async (req, res) => {
  const img = await prisma.image.findUnique({ where: { key: req.params.key } })
  if (!img) return res.status(404).json({ error: 'Не найдено' })
  res.json({ data: img.data })
})

app.delete('/api/images/:key', auth, adminOnly, async (req, res) => {
  await prisma.image.delete({ where: { key: req.params.key } }).catch(() => null)
  res.json({ ok: true })
})

// ========== USERS (ADMIN) ==========

app.get('/api/users', auth, adminOnly, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  const safe = users.map(sanitizeUser)
  res.json(safe)
})

app.put('/api/users/:id', auth, adminOnly, async (req, res) => {
  const data = { ...req.body }
  if (data.password) data.passwordHash = await bcrypt.hash(data.password, 10)
  delete data.password
  const user = await prisma.user.update({ where: { id: req.params.id }, data })
  const safe = sanitizeUser(user)
  res.json(safe)
})

app.delete('/api/users/:id', auth, adminOnly, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить себя' })
  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

// ========== PROMOCODES ==========

app.get('/api/promocodes', auth, adminOnly, async (_req, res) => {
  const codes = await prisma.promoCode.findMany({ orderBy: { id: 'desc' } })
  res.json(codes)
})

app.post('/api/promocodes', auth, adminOnly, async (req, res) => {
  const { code, discount, active, expiresAt } = req.body
  if (!code || !discount) return res.status(400).json({ error: 'Код и скидка обязательны' })
  if (discount < 1 || discount > 90) return res.status(400).json({ error: 'Скидка от 1 до 90%' })
  const pc = await prisma.promoCode.create({ data: { code: code.toUpperCase(), discount, active: active !== false, expiresAt: expiresAt || null } })
  res.json(pc)
})

app.put('/api/promocodes/:id', auth, adminOnly, async (req, res) => {
  const data = { ...req.body }
  if (data.code) data.code = data.code.toUpperCase()
  if (data.discount && (data.discount < 1 || data.discount > 90)) return res.status(400).json({ error: 'Скидка от 1 до 90%' })
  if (data.expiresAt === '') data.expiresAt = null
  const pc = await prisma.promoCode.update({ where: { id: +req.params.id }, data })
  res.json(pc)
})

app.delete('/api/promocodes/:id', auth, adminOnly, async (req, res) => {
  await prisma.promoCode.delete({ where: { id: +req.params.id } })
  res.json({ ok: true })
})

app.post('/api/promocodes/validate', async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Введите промокод' })
  const pc = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } })
  if (!pc) return res.status(404).json({ error: 'Промокод не найден' })
  if (!pc.active) return res.status(400).json({ error: 'Промокод неактивен' })
  if (pc.expiresAt && new Date(pc.expiresAt) < new Date()) return res.status(400).json({ error: 'Срок действия промокода истёк' })
  res.json({ discount: pc.discount, code: pc.code })
})

// ========== REVIEWS (user) ==========

app.post('/api/reviews/product/:productId', auth, async (req, res) => {
  const productId = +req.params.productId
  const { rating, text } = req.body
  if (!rating || !text) return res.status(400).json({ error: 'Заполните рейтинг и текст' })
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Рейтинг от 1 до 5' })
  const existing = await prisma.review.findFirst({ where: { userId: req.user.id, productId } })
  if (existing) return res.status(400).json({ error: 'Вы уже оставили отзыв на этот товар' })
  const deliveredOrders = await prisma.order.findMany({
    where: { userId: req.user.id, status: 'Доставлено' },
    include: { items: true }
  })
  const bought = deliveredOrders.some((o) => o.items.some((it) => it.productId === productId))
  if (!bought) return res.status(403).json({ error: 'Оставить отзыв можно только после доставки товара' })
  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  const review = await prisma.review.create({
    data: { productId, userId: req.user.id, author: user.name, rating, text, date: new Date().toLocaleDateString('ru-RU') }
  })
  res.json(review)
})

// ========== SERVER ==========

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`FORMA SPACE API → http://localhost:${PORT}`))
