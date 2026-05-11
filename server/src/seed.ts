import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  const hashedAdmin = await bcrypt.hash('admin123', 10);
  const hashedUser = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@forma.space' },
    update: {},
    create: {
      email: 'admin@forma.space',
      passwordHash: hashedAdmin,
      name: 'Админ',
      role: 'admin',
      collections: { create: [{ name: 'Гостиная' }, { name: 'Спальня' }] },
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: 'user@test.ru' },
    update: {},
    create: {
      email: 'user@test.ru',
      passwordHash: hashedUser,
      name: 'Алексей',
      role: 'user',
      collections: { create: [{ name: 'Гостиная' }, { name: 'Спальня' }] },
    },
  });

  await prisma.product.createMany({
    data: [
      { name: 'NOVA Lounge Chair', category: 'Кресла', material: 'Массив дуба', color: 'Песочный', price: 74900, eco: 92, width: 78, height: 72, depth: 84, delivery: 3, tag: 'Хит', imageFile: 'nova-lounge-chair.webp', description: 'Низкое лаунж-кресло с честной деревянной рамой и съемным чехлом из переработанного льна.' },
      { name: 'FORMA Modular Sofa', category: 'Диваны', material: 'Букле', color: 'Молочный', price: 189000, eco: 88, width: 260, height: 70, depth: 98, delivery: 6, tag: 'Модульный', imageFile: 'forma-modular-sofa.webp', description: 'Модульный диван, который можно собрать под гостиную, кабинет или студию.' },
      { name: 'TERRA Dining Table', category: 'Столы', material: 'Шпон ореха', color: 'Орех', price: 128500, eco: 95, width: 210, height: 76, depth: 92, delivery: 5, tag: 'Eco+', imageFile: 'terra-dining-table.webp', description: 'Обеденный стол с FSC-шпоном, масляной пропиткой и ремонтопригодной столешницей.' },
      { name: 'LINE Storage Wall', category: 'Хранение', material: 'Березовая фанера', color: 'Графит', price: 156000, eco: 84, width: 320, height: 230, depth: 42, delivery: 8, tag: 'Сборка', imageFile: 'line-storage-wall.webp', description: 'Система хранения с открытыми нишами, скрытыми петлями и модульной конфигурацией.' },
      { name: 'SOFT Bed Platform', category: 'Кровати', material: 'Переработанный текстиль', color: 'Терракота', price: 117900, eco: 90, width: 190, height: 88, depth: 220, delivery: 7, tag: 'New', imageFile: 'soft-bed-platform.webp', description: 'Мягкая кровать-платформа с большим бельевым отсеком и безопасной тканевой обивкой.' },
      { name: 'HALO Floor Lamp', category: 'Свет', material: 'Алюминий', color: 'Черный', price: 38900, eco: 79, width: 38, height: 164, depth: 38, delivery: 2, tag: 'LED', imageFile: 'halo-floor-lamp.webp', description: 'Напольный светильник с диммированием, теплым спектром и сменным LED-модулем.' },
    ],
    skipDuplicates: true,
  });

  await prisma.review.createMany({
    data: [
      { productId: 1, author: 'Марина К.', rating: 5, text: 'Прекрасное кресло! Фактура дерева ощущается руками, чехол мягкий. Доставка аккуратная.', date: '12.04.2026' },
      { productId: 2, author: 'Дмитрий П.', rating: 4, text: 'Диван собрал за 30 минут. Модули стыкуются плотно. Цвет молочный — в жизни чуть теплее, чем на фото.', date: '28.03.2026' },
      { productId: 3, author: 'Анна Л.', rating: 5, text: 'Стол стал центром кухни. Шпон красивый, масляная пропитка пахнет приятно. FSC-сертификат — большой плюс.', date: '05.02.2026' },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seeded:', { admin: admin.email, user: normalUser.email });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
