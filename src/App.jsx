import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API = '/api'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

function formatOrderDate(order) {
  const value = order.createdAt || order.date
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ru-RU') : '—'
}

function productPlaceholder(name, tag) {
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 40 + 25
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect fill="hsl(${hue},28%,88%)" width="1200" height="900"/><text x="600" y="420" text-anchor="middle" font-family="Georgia,serif" font-size="42" fill="hsl(${hue},40%,30%)">${name}</text><text x="600" y="490" text-anchor="middle" font-family="sans-serif" font-size="24" fill="hsl(${hue},30%,50%)">${tag}</text><text x="600" y="540" text-anchor="middle" font-family="sans-serif" font-size="18" fill="hsl(${hue},25%,65%)">FORMA SPACE</text></svg>`)}`
}

function avatarPlaceholder(name) {
  const initials = name ? name.slice(0, 2).toUpperCase() : '??'
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 40 + 25
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="hsl(${hue},28%,30%)" width="200" height="200" rx="100"/><text x="100" y="115" text-anchor="middle" font-family="Georgia,serif" font-size="64" fill="hsl(${hue},28%,88%)">${initials}</text></svg>`)}`
}

const ZOOM_LEVELS = [14, 15, 16, 17, 18]

async function api(path, opts = {}) {
  const token = localStorage.getItem('forma-token')
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...opts, headers })
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || 'Ошибка сервера') }
  return res.json()
}

function App() {
  const [page, setPage] = useState('main')
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('forma-token'))
  const [products, setProducts] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [reviews, setReviews] = useState([])
  const [imageMap, setImageMap] = useState({})
  const [cart, setCart] = useState([])
  const [favorites, setFavorites] = useState([])
  const [collections, setCollections] = useState([])
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Все')
  const [material, setMaterial] = useState('Все')
  const [color, setColor] = useState('Все')
  const [maxPrice, setMaxPrice] = useState(200000)
  const [minEco, setMinEco] = useState(75)
  const [sort, setSort] = useState('popular')
  const [visibleCount, setVisibleCount] = useState(6)
  const [modal, setModal] = useState(null)
  const [activeCollection, setActiveCollection] = useState(0)
  const [newCollName, setNewCollName] = useState('')
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [promo, setPromo] = useState('')
  const [adminTab, setAdminTab] = useState('Товары')
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderDetail, setOrderDetail] = useState(null)
  const [editingReview, setEditingReview] = useState(null)
  const [reviewForm, setReviewForm] = useState(null)
  const [zoomIdx, setZoomIdx] = useState(() => { const s = localStorage.getItem('forma-zoom'); return s ? JSON.parse(s) : 2 })
  const [deliveryMethod, setDeliveryMethod] = useState('courier')
  const [checkoutCity, setCheckoutCity] = useState('')
  const [checkoutStreet, setCheckoutStreet] = useState('')
  const [checkoutPhone, setCheckoutPhone] = useState('')
  const productFileRef = useRef(null)
  const reviewFileRef = useRef(null)

  const isLoggedIn = !!user
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    document.documentElement.style.fontSize = (ZOOM_LEVELS[zoomIdx] || 16) + 'px'
    localStorage.setItem('forma-zoom', JSON.stringify(zoomIdx))
  }, [zoomIdx])

  useEffect(() => { api('/products').then(setProducts).catch(() => {}) }, [])
  useEffect(() => {
    if (token) {
      api('/auth/me').then((u) => {
        setUser({ ...u, role: u.role || 'user' })
        setCart(u.cart?.map((c) => ({ id: c.productId, qty: c.qty })) || [])
        setFavorites(u.favorites?.map((f) => f.productId) || [])
        setCollections(u.collections?.map((c) => ({ id: c.id, name: c.name, items: c.items?.map((i) => i.productId) || [] })) || [])
      }).catch(() => { setUser(null); setToken(null); localStorage.removeItem('forma-token') })
    }
  }, [token])
  useEffect(() => { if (isAdmin) { api('/orders').then(setOrders).catch(() => {}); api('/users').then(setAllUsers).catch(() => {}) } }, [isAdmin, orders.length])
  useEffect(() => { api('/reviews').then(setReviews).catch(() => {}) }, [])

  useEffect(() => {
    let active = true
    async function loadImages() {
      const map = {}
      for (const p of products) {
        try { const img = await api(`/images/img-product-${p.id}`); if (img.data && active) map[`img-product-${p.id}`] = img.data } catch { /* optional image */ }
      }
      for (const key of ['img-room']) {
        try { const img = await api(`/images/${key}`); if (img.data && active) map[key] = img.data } catch { /* optional image */ }
      }
      if (user?.id) { try { const img = await api(`/images/img-avatar-${user.id}`); if (img.data && active) map[`img-avatar-${user.id}`] = img.data } catch { /* optional image */ } }
      for (const r of reviews) {
        try { const img = await api(`/images/img-review-${r.id}`); if (img.data && active) map[`img-review-${r.id}`] = img.data } catch { /* optional image */ }
      }
      if (active) setImageMap(map)
    }
    if (products.length > 0) loadImages()
    return () => { active = false }
  }, [products, reviews, user?.id])

  function getProductImage(p) { const c = imageMap[`img-product-${p.id}`]; if (c) return c; return productPlaceholder(p.name, p.tag) }
  function getUserAvatar(u) { if (u.avatarSrc) return u.avatarSrc; const c = imageMap[`img-avatar-${u.id}`]; if (c) return c; return avatarPlaceholder(u.name) }
  function getReviewImage(r) { const c = imageMap[`img-review-${r.id}`]; if (c) return c; return null }
  const heroImage = '/images/hero-new.webp'

  const categories = ['Все', ...new Set(products.map((p) => p.category))]
  const materials = ['Все', ...new Set(products.map((p) => p.material))]
  const colors = ['Все', ...new Set(products.map((p) => p.color))]

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()))
      .filter((p) => category === 'Все' || p.category === category)
      .filter((p) => material === 'Все' || p.material === material)
      .filter((p) => color === 'Все' || p.color === color)
      .filter((p) => p.price <= Number(maxPrice) && p.eco >= Number(minEco))
      .sort((a, b) => {
        if (sort === 'priceAsc') return a.price - b.price
        if (sort === 'priceDesc') return b.price - a.price
        if (sort === 'eco') return b.eco - a.eco
        return b.eco + b.price / 10000 - (a.eco + a.price / 10000)
      })
  }, [category, color, material, maxPrice, minEco, products, query, sort])

  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const cartItems = cart.map((item) => { const p = products.find((pr) => pr.id === item.id); return p ? { ...p, qty: item.qty } : null }).filter(Boolean)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0)
  const discount = promo.trim().toUpperCase() === 'FORMA10' ? subtotal * 0.1 : 0
  const deliveryCost = subtotal > 120000 || subtotal === 0 ? 0 : (deliveryMethod === 'courier' ? 5999 : 0)
  const vat = Math.round((subtotal - discount) * 0.2 / 1.2)
  const total = subtotal - discount + deliveryCost
  const suggestions = query ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3) : []

  function getCartQty(id) { return cart.find((i) => i.id === id)?.qty || 0 }

  async function addToCart(product) {
    if (!isLoggedIn) return
    const existing = cart.find((i) => i.id === product.id)
    const newQty = existing ? existing.qty + 1 : 1
    await api(`/cart/${product.id}`, { method: 'PUT', body: JSON.stringify({ qty: newQty }) })
    setCart((prev) => existing ? prev.map((i) => i.id === product.id ? { ...i, qty: newQty } : i) : [...prev, { id: product.id, qty: 1 }])
  }

  async function updateQty(productId, delta) {
    if (!isLoggedIn) return
    const current = cart.find((i) => i.id === productId)
    if (!current) return
    const newQty = current.qty + delta
    if (newQty <= 0) { await api(`/cart/${productId}`, { method: 'DELETE' }); setCart((prev) => prev.filter((i) => i.id !== productId)) }
    else { await api(`/cart/${productId}`, { method: 'PUT', body: JSON.stringify({ qty: newQty }) }); setCart((prev) => prev.map((i) => i.id === productId ? { ...i, qty: newQty } : i)) }
  }

  async function removeFromCart(productId) {
    if (!isLoggedIn) return
    await api(`/cart/${productId}`, { method: 'DELETE' })
    setCart((prev) => prev.filter((i) => i.id !== productId))
  }

  async function toggleFavorite(productId) {
    if (!isLoggedIn) return
    const isFav = favorites.includes(productId)
    if (isFav) { await api(`/favorites/${productId}`, { method: 'DELETE' }); setFavorites((prev) => prev.filter((id) => id !== productId)) }
    else { await api(`/favorites/${productId}`, { method: 'POST' }); setFavorites((prev) => [...prev, productId]) }
  }

  async function addToCollection(productId) {
    if (!isLoggedIn || !collections[activeCollection]) return
    const col = collections[activeCollection]
    if (col.items.includes(productId)) return
    await api(`/collections/${col.id}/add`, { method: 'POST', body: JSON.stringify({ productId }) })
    setCollections((prev) => prev.map((c, i) => i === activeCollection ? { ...c, items: [...c.items, productId] } : c))
  }

  async function removeFromCollection(productId) {
    if (!isLoggedIn || !collections[activeCollection]) return
    const col = collections[activeCollection]
    await api(`/collections/${col.id}/remove`, { method: 'POST', body: JSON.stringify({ productId }) })
    setCollections((prev) => prev.map((c, i) => i === activeCollection ? { ...c, items: c.items.filter((id) => id !== productId) } : c))
  }

  async function addCollection() {
    if (!isLoggedIn || !newCollName.trim()) return
    const col = await api('/collections', { method: 'POST', body: JSON.stringify({ name: newCollName.trim() }) })
    setCollections((prev) => [...prev, { id: col.id, name: col.name, items: [] }])
    setNewCollName('')
  }

  async function deleteCollection(idx) {
    if (!isLoggedIn) return
    const col = collections[idx]
    if (!col) return
    await api(`/collections/${col.id}`, { method: 'DELETE' })
    setCollections((prev) => prev.filter((_, i) => i !== idx))
    if (activeCollection >= idx) setActiveCollection(Math.max(0, activeCollection - 1))
  }

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    try {
      const res = await api('/auth/login', { method: 'POST', body: JSON.stringify(authForm) })
      localStorage.setItem('forma-token', res.token)
      setToken(res.token)
      setUser(res.user)
      setCart(res.user.cart?.map((c) => ({ id: c.productId, qty: c.qty })) || [])
      setFavorites(res.user.favorites?.map((f) => f.productId) || [])
      setCollections(res.user.collections?.map((c) => ({ id: c.id, name: c.name, items: c.items?.map((i) => i.productId) || [] })) || [])
      setAuthForm({ email: '', password: '', name: '' })
      setPage('main')
    } catch (err) { setAuthError(err.message) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    try {
      const res = await api('/auth/register', { method: 'POST', body: JSON.stringify(authForm) })
      localStorage.setItem('forma-token', res.token)
      setToken(res.token)
      setUser(res.user)
      setAuthForm({ email: '', password: '', name: '' })
      setAuthSuccess('Аккаунт создан! Перенаправление...')
      setTimeout(() => setPage('main'), 800)
    } catch (err) { setAuthError(err.message) }
  }

  function handleLogout() { setUser(null); setToken(null); setCart([]); setFavorites([]); setCollections([]); localStorage.removeItem('forma-token'); setPage('main') }

  const emptyProduct = { name: '', category: 'Кресла', material: '', color: '', price: 50000, eco: 80, width: 0, height: 0, depth: 0, delivery: 3, tag: '', imageFile: '', description: '' }

  function startEditProduct(product) { setEditingProduct(product.id); setProductForm({ ...product }) }
  function startNewProduct() { setEditingProduct('new'); setProductForm({ ...emptyProduct, id: Date.now() }) }

  async function handleProductImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    setProductForm((f) => ({ ...f, imageSrc: b64, imageFile: file.name }))
    e.target.value = ''
  }

  function fileToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const original = reader.result
        if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return resolve(original)
        const img = new Image()
        img.onload = () => {
          const maxSide = 1200
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.86))
        }
        img.onerror = () => resolve(original)
        img.src = original
      }
      reader.readAsDataURL(file)
    })
  }

  async function saveProduct() {
    if (!productForm.name) return
    try {
      let saved
      if (editingProduct === 'new') {
        const data = { ...productForm }
        delete data.imageSrc
        delete data.id
        saved = await api('/products', { method: 'POST', body: JSON.stringify(data) })
      } else {
        const data = { ...productForm }
        delete data.imageSrc
        saved = await api(`/products/${editingProduct}`, { method: 'PUT', body: JSON.stringify(data) })
      }
      if (productForm.imageSrc) {
        await api('/images', { method: 'POST', body: JSON.stringify({ key: `img-product-${saved.id}`, data: productForm.imageSrc, productId: saved.id }) })
        setImageMap((m) => ({ ...m, [`img-product-${saved.id}`]: productForm.imageSrc }))
      }
      setProducts((prev) => editingProduct === 'new' ? [...prev, saved] : prev.map((p) => p.id === saved.id ? saved : p))
      setEditingProduct(null); setProductForm(null)
    } catch (err) { alert(err.message) }
  }

  async function deleteProduct(id) {
    await api(`/products/${id}`, { method: 'DELETE' })
    await api(`/images/img-product-${id}`, { method: 'DELETE' }).catch(() => {})
    setImageMap((m) => { const n = { ...m }; delete n[`img-product-${id}`]; return n })
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }
  function cancelEditProduct() { setEditingProduct(null); setProductForm(null) }

  function startEditUser(u) { setEditingUser(u.id); setUserForm({ ...u, password: '' }) }
  function startNewUser() { setEditingUser('new'); setUserForm({ email: '', password: '', name: '', role: 'user' }) }

  async function saveUser() {
    if (!userForm.email || !userForm.name) return
    try {
      const data = { ...userForm }
      if (!data.password) delete data.password
      if (editingUser === 'new') {
        const saved = await api('/users', { method: 'POST', body: JSON.stringify(data) })
        setAllUsers((prev) => [...prev, saved])
      } else {
        const saved = await api(`/users/${editingUser}`, { method: 'PUT', body: JSON.stringify(data) })
        setAllUsers((prev) => prev.map((u) => u.id === saved.id ? saved : u))
      }
      setEditingUser(null); setUserForm(null)
    } catch (err) { alert(err.message) }
  }

  async function deleteUser(id) {
    if (user?.id === id) return
    await api(`/users/${id}`, { method: 'DELETE' })
    setAllUsers((prev) => prev.filter((u) => u.id !== id))
  }
  function cancelEditUser() { setEditingUser(null); setUserForm(null) }

  async function handleProfileAvatarUpload(e) {
    const file = e.target.files[0]; if (!file || !user) return
    const b64 = await fileToBase64(file)
    await api('/images', { method: 'POST', body: JSON.stringify({ key: `img-avatar-${user.id}`, data: b64, userId: user.id }) })
    setImageMap((m) => ({ ...m, [`img-avatar-${user.id}`]: b64 }))
    setUser((prev) => ({ ...prev, avatarSrc: b64 }))
  }

  async function handleOrder() {
    try {
      await api('/orders', { method: 'POST', body: JSON.stringify({ total, promo, deliveryMethod, city: checkoutCity, street: checkoutStreet, phone: checkoutPhone, pickupAddress: deliveryMethod === 'pickup' ? 'г. Туймазы, ул. Салавата Юлаева, д. 12' : '' }) })
      setCart([]); setPromo(''); setCheckoutStep(1); setCheckoutCity(''); setCheckoutStreet(''); setCheckoutPhone(''); setOrderSuccess(true)
    } catch (err) { alert(err.message) }
  }

  const emptyReview = { productId: 1, author: '', rating: 5, text: '', date: new Date().toLocaleDateString('ru-RU') }

  function startEditReview(r) { setEditingReview(r.id); setReviewForm({ ...r }) }
  function startNewReview() { setEditingReview('new'); setReviewForm({ ...emptyReview, id: Date.now() }) }

  async function handleReviewImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const b64 = await fileToBase64(file)
    setReviewForm((f) => ({ ...f, imageSrc: b64 }))
    e.target.value = ''
  }

  async function saveReview() {
    if (!reviewForm.author || !reviewForm.text) return
    try {
      const { imageSrc, ...data } = reviewForm
      let saved
      if (editingReview === 'new') saved = await api('/reviews', { method: 'POST', body: JSON.stringify(data) })
      else saved = await api(`/reviews/${editingReview}`, { method: 'PUT', body: JSON.stringify(data) })
      if (imageSrc) {
        await api('/images', { method: 'POST', body: JSON.stringify({ key: `img-review-${saved.id}`, data: imageSrc, reviewId: saved.id }) })
        setImageMap((m) => ({ ...m, [`img-review-${saved.id}`]: imageSrc }))
      }
      setReviews((prev) => editingReview === 'new' ? [...prev, saved] : prev.map((r) => r.id === saved.id ? saved : r))
      setEditingReview(null); setReviewForm(null)
    } catch (err) { alert(err.message) }
  }

  async function deleteReview(id) {
    await api(`/reviews/${id}`, { method: 'DELETE' })
    await api(`/images/img-review-${id}`, { method: 'DELETE' }).catch(() => {})
    setImageMap((m) => { const n = { ...m }; delete n[`img-review-${id}`]; return n })
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }
  function cancelEditReview() { setEditingReview(null); setReviewForm(null) }

  function confirmDeleteAction() {
    if (!confirmDelete) return
    if (confirmDelete.type === 'product') deleteProduct(confirmDelete.id)
    else if (confirmDelete.type === 'user') deleteUser(confirmDelete.id)
    else if (confirmDelete.type === 'order') api(`/orders/${confirmDelete.id}`, { method: 'DELETE' }).then(() => setOrders((prev) => prev.filter((o) => o.id !== confirmDelete.id)))
    else if (confirmDelete.type === 'review') deleteReview(confirmDelete.id)
    setConfirmDelete(null)
  }

  const zoomToolbar = (
    <div className="zoom-toolbar" role="toolbar" aria-label="Масштаб страницы">
      <button type="button" onClick={() => setZoomIdx((i) => Math.max(i - 1, 0))} disabled={zoomIdx === 0} title="Уменьшить шрифт">A-</button>
      <button type="button" onClick={() => setZoomIdx(2)} title="Сбросить масштаб">A</button>
      <button type="button" onClick={() => setZoomIdx((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1} title="Увеличить шрифт">A+</button>
    </div>
  )

  if (page === 'admin' && !isAdmin) setPage('main')

  if (page === 'auth') {
    return (
      <main className="auth-page">
        <header className="site-header"><a className="brand" href="#top" onClick={() => setPage('main')}>FORMA<span>SPACE</span></a><div className="header-actions">{zoomToolbar}</div></header>
        <section className="auth-section">
          <div className="auth-card animate-in">
            <div className="auth-tabs">
              <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess('') }}>Вход</button>
              <button className={authMode === 'register' ? 'active' : ''} type="button" onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess('') }}>Регистрация</button>
            </div>
            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
              {authMode === 'register' && <label>Имя<input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Алексей" /></label>}
              <label>Email<input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="user@test.ru" /></label>
              <label>Пароль<input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Минимум 6 символов" /></label>
              {authError && <p className="auth-error">{authError}</p>}
              {authSuccess && <p className="auth-success">{authSuccess}</p>}
              <button className="auth-submit" type="submit">{authMode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
            </form>
            {authMode === 'login' && <div className="auth-hint"><p>Демо-аккаунты:</p><p>Админ: admin@forma.space / admin123</p><p>Пользователь: user@test.ru / user123</p></div>}
          </div>
        </section>
      </main>
    )
  }

  if (page === 'admin' && isAdmin) {
    return (
      <main>
        <header className="site-header">
          <a className="brand" href="#top" onClick={() => setPage('main')}>FORMA<span>SPACE</span></a>
          <nav><a href="#" onClick={() => setPage('main')}>На сайт</a><span className="admin-badge">Админ-панель</span></nav>
          <div className="header-actions">{zoomToolbar}<button className="button ghost small" type="button" onClick={handleLogout}>Выйти</button></div>
        </header>
        <section className="section admin-page">
          <div className="section-heading"><p className="eyebrow">Администратор</p><h2>Панель управления</h2></div>
          <div className="admin-tabs">{['Товары', 'Заказы', 'Пользователи', 'Отзывы', 'Аналитика'].map((tab) => (<button className={adminTab === tab ? 'active' : ''} key={tab} type="button" onClick={() => setAdminTab(tab)}>{tab}</button>))}</div>
          <div className="admin-board">
            {adminTab === 'Товары' && (
              <div className="admin-crud">
                <div className="crud-header"><h3>Товары ({products.length})</h3><button className="crud-add" type="button" onClick={startNewProduct}>+ Добавить товар</button></div>
                {editingProduct && (
                  <div className="crud-form animate-in">
                    <h4>{editingProduct === 'new' ? 'Новый товар' : 'Редактирование'}</h4>
                    <div className="crud-form-grid">
                      <label>Название<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
                      <label>Категория<select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>{['Кресла','Диваны','Столы','Хранение','Кровати','Свет'].map((c) => <option key={c}>{c}</option>)}</select></label>
                      <label>Материал<input value={productForm.material} onChange={(e) => setProductForm({ ...productForm, material: e.target.value })} /></label>
                      <label>Цвет<input value={productForm.color} onChange={(e) => setProductForm({ ...productForm, color: e.target.value })} /></label>
                      <label>Цена<input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} /></label>
                      <label>Eco %<input type="number" min="0" max="100" value={productForm.eco} onChange={(e) => setProductForm({ ...productForm, eco: Number(e.target.value) })} /></label>
                      <label>Ш x В x Г<input type="number" value={productForm.width} onChange={(e) => setProductForm({ ...productForm, width: Number(e.target.value) })} style={{width:'4rem',display:'inline-block'}} /> x <input type="number" value={productForm.height} onChange={(e) => setProductForm({ ...productForm, height: Number(e.target.value) })} style={{width:'4rem',display:'inline-block'}} /> x <input type="number" value={productForm.depth} onChange={(e) => setProductForm({ ...productForm, depth: Number(e.target.value) })} style={{width:'4rem',display:'inline-block'}} /> см</label>
                      <label>Срок изготовления, дней<input type="number" value={productForm.delivery} onChange={(e) => setProductForm({ ...productForm, delivery: Number(e.target.value) })} /></label>
                      <label>Тег<input value={productForm.tag} onChange={(e) => setProductForm({ ...productForm, tag: e.target.value })} /></label>
                    </div>
                    <div className="file-picker"><span>Картинка товара</span><input type="file" accept="image/*" ref={productFileRef} onChange={handleProductImageUpload} /><button type="button" onClick={() => productFileRef.current?.click()}>Выбрать фото</button>{productForm.imageFile && <em>{productForm.imageFile}</em>}</div>
                    {(productForm.imageSrc || imageMap[`img-product-${productForm.id}`]) && <div className="crud-preview"><img src={productForm.imageSrc || imageMap[`img-product-${productForm.id}`]} alt="preview" /></div>}
                    <label>Описание<textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>
                    <div className="crud-form-actions"><button className="crud-save" type="button" onClick={saveProduct}>Сохранить</button><button className="crud-cancel" type="button" onClick={cancelEditProduct}>Отмена</button></div>
                  </div>
                )}
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>Фото</th><th>Название</th><th>Категория</th><th>Цена</th><th>Eco</th><th></th></tr></thead><tbody>{products.map((p) => (<tr key={p.id}><td>{p.id}</td><td><img className="crud-thumb" src={getProductImage(p)} alt="" /></td><td>{p.name}</td><td>{p.category}</td><td>{money.format(p.price)}</td><td>{p.eco}%</td><td className="crud-actions"><button className="crud-edit" type="button" onClick={() => startEditProduct(p)}>Изменить</button><button className="crud-delete" type="button" onClick={() => setConfirmDelete({ type: 'product', id: p.id, name: p.name })}>Удалить</button></td></tr>))}</tbody></table></div>
              </div>
            )}
            {adminTab === 'Заказы' && (
              <div className="admin-crud">
                <div className="crud-header"><h3>Заказы ({orders.length})</h3></div>
                {orders.length === 0 ? <div className="admin-placeholder"><p>Заказов пока нет.</p></div> : (
                  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>Клиент</th><th>Дата</th><th>Сумма</th><th>Доставка</th><th>Статус</th><th></th></tr></thead><tbody>{orders.map((o) => (<tr key={o.id}><td>{o.id}</td><td>{o.userName}</td><td>{formatOrderDate(o)}</td><td>{money.format(o.total)}</td><td>{o.deliveryMethod === 'courier' ? 'Курьер' : 'Самовывоз'}</td><td><span className={`status-badge ${o.status === 'Оплачен' ? 'paid' : ''}`}>{o.status}</span></td><td className="crud-actions"><button className="crud-edit" type="button" onClick={() => setOrderDetail(o)}>Подробнее</button><button className="crud-delete" type="button" onClick={() => setConfirmDelete({ type: 'order', id: o.id, name: `Заказ #${o.id}` })}>Удалить</button></td></tr>))}</tbody></table></div>
                )}
              </div>
            )}
            {adminTab === 'Пользователи' && (
              <div className="admin-crud">
                <div className="crud-header"><h3>Пользователи ({allUsers.length})</h3><button className="crud-add" type="button" onClick={startNewUser}>+ Добавить</button></div>
                {editingUser && (
                  <div className="crud-form animate-in">
                    <h4>{editingUser === 'new' ? 'Новый пользователь' : 'Редактирование'}</h4>
                    <div className="crud-form-grid">
                      <label>Имя<input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></label>
                      <label>Email<input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></label>
                      <label>Пароль<input type="password" value={userForm.password || ''} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></label>
                      <label>Роль<select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="user">Пользователь</option><option value="admin">Админ</option></select></label>
                    </div>
                    <div className="crud-form-actions"><button className="crud-save" type="button" onClick={saveUser}>Сохранить</button><button className="crud-cancel" type="button" onClick={cancelEditUser}>Отмена</button></div>
                  </div>
                )}
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>Имя</th><th>Email</th><th>Роль</th><th></th></tr></thead><tbody>{allUsers.map((u) => (<tr key={u.id}><td>{u.id}</td><td>{u.name}</td><td>{u.email}</td><td>{u.role === 'admin' ? 'Админ' : 'Пользователь'}</td><td className="crud-actions"><button className="crud-edit" type="button" onClick={() => startEditUser(u)}>Изменить</button>{user?.id !== u.id && <button className="crud-delete" type="button" onClick={() => setConfirmDelete({ type: 'user', id: u.id, name: u.name })}>Удалить</button>}</td></tr>))}</tbody></table></div>
              </div>
            )}
            {adminTab === 'Отзывы' && (
              <div className="admin-crud">
                <div className="crud-header"><h3>Отзывы ({reviews.length})</h3><button className="crud-add" type="button" onClick={startNewReview}>+ Добавить отзыв</button></div>
                {editingReview && (
                  <div className="crud-form animate-in">
                    <h4>{editingReview === 'new' ? 'Новый отзыв' : 'Редактирование'}</h4>
                    <div className="crud-form-grid">
                      <label>Автор<input value={reviewForm.author} onChange={(e) => setReviewForm({ ...reviewForm, author: e.target.value })} placeholder="Марина К." /></label>
                      <label>Товар<select value={reviewForm.productId} onChange={(e) => setReviewForm({ ...reviewForm, productId: Number(e.target.value) })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                      <label>Рейтинг<select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}>{[5,4,3,2,1].map((v) => <option key={v} value={v}>{'★'.repeat(v)}{'☆'.repeat(5-v)}</option>)}</select></label>
                      <label>Дата<input value={reviewForm.date} onChange={(e) => setReviewForm({ ...reviewForm, date: e.target.value })} placeholder="01.05.2026" /></label>
                    </div>
                    <label>Текст отзыва<textarea value={reviewForm.text} onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })} /></label>
                    <div className="file-picker"><span>Фото отзыва</span><input type="file" accept="image/*" ref={reviewFileRef} onChange={handleReviewImageUpload} /><button type="button" onClick={() => reviewFileRef.current?.click()}>Выбрать фото</button>{reviewForm.imageSrc && <em>Фото выбрано</em>}</div>
                    {(reviewForm.imageSrc || imageMap[`img-review-${reviewForm.id}`]) && <div className="crud-preview"><img src={reviewForm.imageSrc || imageMap[`img-review-${reviewForm.id}`]} alt="review" /></div>}
                    <div className="crud-form-actions"><button className="crud-save" type="button" onClick={saveReview}>Сохранить</button><button className="crud-cancel" type="button" onClick={cancelEditReview}>Отмена</button></div>
                  </div>
                )}
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>Фото</th><th>Автор</th><th>Товар</th><th>Рейтинг</th><th>Текст</th><th></th></tr></thead><tbody>{reviews.map((r) => { const rp = products.find((p) => p.id === r.productId); return (<tr key={r.id}><td>{r.id}</td><td>{getReviewImage(r) ? <img className="crud-thumb" src={getReviewImage(r)} alt="" /> : '—'}</td><td>{r.author}</td><td>{rp?.name || '—'}</td><td>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</td><td style={{maxWidth:'12rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.text}</td><td className="crud-actions"><button className="crud-edit" type="button" onClick={() => startEditReview(r)}>Изменить</button><button className="crud-delete" type="button" onClick={() => setConfirmDelete({ type: 'review', id: r.id, name: `${r.author} — ${rp?.name || ''}` })}>Удалить</button></td></tr>)})}</tbody></table></div>
              </div>
            )}
            {adminTab === 'Аналитика' && (<div className="admin-metrics"><div className="metric"><span>Выручка</span><strong>{money.format(orders.reduce((s, o) => s + o.total, 0) || 0)}</strong></div><div className="metric"><span>Заказов</span><strong>{orders.length}</strong></div><div className="metric"><span>Средний eco</span><strong>88%</strong></div><div className="metric"><span>Конверсия</span><strong>6.8%</strong></div></div>)}
          </div>
        </section>
        {confirmDelete && (
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="modal confirm-modal animate-in" onClick={(e) => e.stopPropagation()}>
              <h3>Удалить {confirmDelete.type === 'product' ? 'товар' : confirmDelete.type === 'user' ? 'пользователя' : confirmDelete.type === 'review' ? 'отзыв' : 'заказ'}?</h3>
              <p>{confirmDelete.name}</p>
              <div className="crud-form-actions"><button className="crud-delete" type="button" onClick={confirmDeleteAction}>Удалить</button><button className="crud-cancel" type="button" onClick={() => setConfirmDelete(null)}>Отмена</button></div>
            </div>
          </div>
        )}
        {orderDetail && (
          <div className="modal-overlay" onClick={() => setOrderDetail(null)}>
            <div className="modal order-detail-modal animate-in" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" type="button" onClick={() => setOrderDetail(null)}>✕</button>
              <h2>Заказ #{orderDetail.id}</h2>
              <div className="order-detail-grid">
                <div className="order-detail-field"><span className="order-detail-label">Клиент</span><strong>{orderDetail.userName}</strong></div>
                <div className="order-detail-field"><span className="order-detail-label">Дата</span><strong>{formatOrderDate(orderDetail)}</strong></div>
                <div className="order-detail-field"><span className="order-detail-label">Статус</span><span className={`status-badge ${orderDetail.status === 'Оплачен' ? 'paid' : ''}`}>{orderDetail.status}</span></div>
                <div className="order-detail-field"><span className="order-detail-label">Доставка</span><strong>{orderDetail.deliveryMethod === 'courier' ? 'Курьер' : 'Самовывоз'}</strong></div>
                {orderDetail.deliveryMethod === 'courier' && (<>
                  <div className="order-detail-field"><span className="order-detail-label">Город</span><strong>{orderDetail.city || '—'}</strong></div>
                  <div className="order-detail-field"><span className="order-detail-label">Адрес</span><strong>{orderDetail.street || '—'}</strong></div>
                </>)}
                {orderDetail.deliveryMethod === 'pickup' && (<div className="order-detail-field"><span className="order-detail-label">Пункт выдачи</span><strong>{orderDetail.pickupAddress}</strong></div>)}
                <div className="order-detail-field"><span className="order-detail-label">Телефон</span><strong>{orderDetail.phone || '—'}</strong></div>
                <div className="order-detail-field"><span className="order-detail-label">Промокод</span><strong>{orderDetail.promo || '—'}</strong></div>
                <div className="order-detail-field"><span className="order-detail-label">Сумма</span><strong>{money.format(orderDetail.total)}</strong></div>
              </div>
              <h3>Товары</h3>
              <div className="order-items-list">
                {(orderDetail.items || []).map((item) => (<div className="order-item-row" key={item.id}><span>{item.name}</span><span>{item.qty} шт.</span><span>{money.format(item.price * item.qty)}</span></div>))}
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top"><span>FORMA</span><span>SPACE</span></a>
        <nav>
          <a href="#catalog">Каталог</a>
          <a href="#checkout">Корзина</a>
          {isLoggedIn && <a href="#profile">Профиль</a>}
          {isAdmin && <a href="#" onClick={() => setPage('admin')}>Админ</a>}
        </nav>
        <div className="header-actions">
          {zoomToolbar}
          <button className="header-icon" type="button" onClick={() => document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth' })} title="Корзина">🛒 {cart.length > 0 && <span className="icon-badge">{cart.reduce((s, i) => s + i.qty, 0)}</span>}</button>
          {isLoggedIn ? (
            <div className="user-badge">
              <img className="avatar-small-img" src={getUserAvatar(user)} alt="" />
              <span>{user.name}</span>
              <button className="button ghost small" type="button" onClick={handleLogout}>Выйти</button>
            </div>
          ) : (
            <button className="button primary small" type="button" onClick={() => setPage('auth')}>Войти</button>
          )}
        </div>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-copy animate-in">
          <p className="eyebrow">Минимализм / честные материалы / умный подбор</p>
          <h1>Дизайнерская мебель, проверенная вашим интерьером.</h1>
          <p>FORMA SPACE — каталог мебели с прозрачной эко-информацией, проверкой габаритов и подбором под ваше пространство.</p>
          <div className="hero-actions"><a className="button primary" href="#catalog">Собрать интерьер</a></div>
        </div>
        <div className="hero-showcase animate-in">
          <img src={heroImage} alt="Минималистичный интерьер" />
          <div className="floating-card top-card animate-float"><strong>Eco ID</strong><span>FSC, переработанный текстиль, CO2 -18%</span></div>
          <div className="floating-card bottom-card animate-float-slow"><strong>Fit score 94%</strong><span>Размеры совпадают с планом комнаты</span></div>
        </div>
      </section>

      <section className="section" id="catalog">
        <div className="section-heading"><p className="eyebrow">Каталог</p><h2>Мебель</h2></div>
        <div className="catalog-layout">
          <aside className="filters">
            <label>Поиск<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Диван, кресло, свет..." /></label>
            {suggestions.length > 0 && <div className="suggestions">{suggestions.map((p) => <button key={p.id} type="button" onClick={() => setModal(p)}>{p.name}</button>)}</div>}
            <label>Категория<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Материал<select value={material} onChange={(e) => setMaterial(e.target.value)}>{materials.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label>Цвет<select value={color} onChange={(e) => setColor(e.target.value)}>{colors.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Цена до {money.format(maxPrice)}<input type="range" min="30000" max="220000" step="5000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></label>
            <label>Эко-рейтинг от {minEco}%<input type="range" min="70" max="100" value={minEco} onChange={(e) => setMinEco(e.target.value)} /></label>
            <label>Сортировка<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="popular">Популярность</option><option value="priceAsc">Цена ↑</option><option value="priceDesc">Цена ↓</option><option value="eco">Эко-рейтинг</option></select></label>
          </aside>
          <div className="products-area">
            <div className="catalog-meta"><span>{filteredProducts.length} товаров</span></div>
            <div className="product-grid">
              {visibleProducts.map((p) => {
                const inCart = getCartQty(p.id)
                return (
                  <article className="product-card animate-in" key={p.id}>
                    <img src={getProductImage(p)} alt={p.name} onClick={() => setModal(p)} />
                    <div>
                      <span className="tag">{p.tag}</span>
                      <h3 onClick={() => setModal(p)}>{p.name}</h3>
                      <p>{p.material} / {p.color}</p>
                      <div className="product-bottom"><strong>{money.format(p.price)}</strong><span>Eco {p.eco}%</span></div>
                      <div className="card-actions">
                        <button type="button" onClick={() => setModal(p)}>Подробнее</button>
                        {inCart > 0 ? (
                          <div className="inline-qty"><button type="button" onClick={() => updateQty(p.id, -1)}>-</button><span>{inCart}</span><button type="button" onClick={() => updateQty(p.id, 1)}>+</button></div>
                        ) : (
                          <button type="button" onClick={() => addToCart(p)}>{isLoggedIn ? 'В корзину' : 'Войдите'}</button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            {visibleCount < filteredProducts.length && <button className="load-more" type="button" onClick={() => setVisibleCount((c) => c + 4)}>Загрузить еще</button>}
          </div>
        </div>
      </section>

      <section className="section two-column" id="checkout">
        <div className="panel">
          <div className="section-heading compact"><p className="eyebrow">Корзина</p><h2>Ваш заказ</h2></div>
          {!isLoggedIn ? <p>Войдите в аккаунт, чтобы оформить заказ.</p> : cartItems.length === 0 ? <p>Корзина пуста. Добавьте товары из каталога.</p> : cartItems.map((item) => (
            <div className="cart-row" key={item.id}>
              <img src={getProductImage(item)} alt="" />
              <div><strong>{item.name}</strong><span>{money.format(item.price)} x {item.qty}</span></div>
              <div className="qty"><button type="button" onClick={() => updateQty(item.id, -1)}>-</button><span>{item.qty}</span><button type="button" onClick={() => updateQty(item.id, 1)}>+</button></div>
              <button className="cart-remove" type="button" onClick={() => removeFromCart(item.id)}>✕</button>
            </div>
          ))}
          {isLoggedIn && cartItems.length > 0 && (<>
            <label className="promo">Промокод<input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="FORMA10 — скидка 10%" /></label>
            <div className="totals">
              <span>Товары: {money.format(subtotal)}</span>
              {discount > 0 && <span>Скидка: -{money.format(discount)}</span>}
              <span>Доставка: {deliveryCost === 0 ? 'бесплатно' : money.format(deliveryCost)}</span>
              <span>НДС 20%: {money.format(vat)}</span>
              <strong>Итого: {money.format(total)}</strong>
            </div>
          </>)}
        </div>
        {isLoggedIn && cartItems.length > 0 && (
          <div className="panel checkout-flow">
            <p className="eyebrow">Оформление заказа</p>
            {['Доставка', 'Адрес', 'Оплата'].map((step, i) => (
              <button className={checkoutStep === i + 1 ? 'step active' : 'step'} key={step} type="button" onClick={() => setCheckoutStep(i + 1)}><span>0{i + 1}</span>{step}</button>
            ))}
            <div className="checkout-note">
              {checkoutStep === 1 && (<>
                <strong>Способ доставки</strong>
                <label><input type="radio" name="delivery" checked={deliveryMethod === 'courier'} onChange={() => setDeliveryMethod('courier')} /> Курьер — {subtotal > 120000 ? 'бесплатно' : money.format(5999)}</label>
                <label><input type="radio" name="delivery" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} /> Самовывоз — бесплатно</label>
                {deliveryMethod === 'pickup' && <div className="pickup-address"><strong>Пункт выдачи:</strong><p>г. Туймазы, ул. Салавата Юлаева, д. 12</p></div>}
              </>)}
              {checkoutStep === 2 && (<>
                {deliveryMethod === 'courier' ? (<>
                  <strong>Адрес доставки</strong>
                  <label>Город<input value={checkoutCity} onChange={(e) => setCheckoutCity(e.target.value)} placeholder="" /></label>
                  <label>Улица и дом<input value={checkoutStreet} onChange={(e) => setCheckoutStreet(e.target.value)} placeholder="" /></label>
                  <label>Телефон<input value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} placeholder="+7 999 123-45-67" /></label>
                </>) : (<>
                  <strong>Пункт выдачи</strong>
                  <div className="pickup-address"><p>г. Туймазы, ул. Салавата Юлаева, д. 12</p></div>
                  <label>Телефон<input value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} placeholder="+7 999 123-45-67" /></label>
                </>)}
              </>)}
              {checkoutStep === 3 && (<>
                <strong>Оплата</strong>
                <label><input type="radio" name="pay" defaultChecked /> Картой онлайн</label>
                <label><input type="radio" name="pay" /> При получении</label>
                <button className="crud-save pay-btn" type="button" onClick={handleOrder} disabled={cartItems.length === 0}>Оплатить {money.format(total)}</button>
              </>)}
            </div>
          </div>
        )}
      </section>

      {isLoggedIn && (
        <section className="section" id="profile">
          <div className="profile-top-row">
            <div className="panel profile-card">
              <div className="avatar-wrap">
                <img className="avatar-img" src={getUserAvatar(user)} alt="" />
                <label className="avatar-upload-btn">Сменить аватар<input type="file" accept="image/*" onChange={handleProfileAvatarUpload} hidden /></label>
              </div>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
            <div className="panel">
              <p className="eyebrow">Избранное и коллекции</p>
              <div className="collection-tabs">
                {collections.map((col, i) => (
                  <button key={col.id} className={activeCollection === i ? 'active' : ''} type="button" onClick={() => setActiveCollection(i)}>
                    {col.name}
                    <span className="coll-count">{col.items.length}</span>
                    {collections.length > 1 && <span className="coll-del" onClick={(e) => { e.stopPropagation(); deleteCollection(i) }}>✕</span>}
                  </button>
                ))}
              </div>
              <div className="new-coll"><input value={newCollName} onChange={(e) => setNewCollName(e.target.value)} placeholder="Новая коллекция" /><button type="button" onClick={addCollection}>+</button></div>
              <div className="favorite-list">
                {favorites.length === 0 ? <p>Нажмите ★ в карточке товара, чтобы добавить.</p> : favorites.map((id) => {
                  const p = products.find((item) => item.id === id)
                  if (!p) return null
                  const inColl = collections[activeCollection]?.items.includes(id)
                  return (
                    <div className="fav-item" key={id}>
                      <img src={getProductImage(p)} alt="" className="fav-thumb" />
                      <span>{p.name}</span>
                      <button type="button" onClick={() => inColl ? removeFromCollection(id) : addToCollection(id)}>{inColl ? '✓ В коллекции' : '+ В коллекцию'}</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {collections[activeCollection] && collections[activeCollection].items.length > 0 && (
            <div className="collection-view">
              <div className="section-heading"><p className="eyebrow">Коллекция</p><h2>{collections[activeCollection].name}</h2></div>
              <div className="product-grid">
                {collections[activeCollection].items.map((id) => {
                  const p = products.find((item) => item.id === id)
                  if (!p) return null
                  const inCart = getCartQty(p.id)
                  return (
                    <article className="product-card animate-in" key={p.id}>
                      <img src={getProductImage(p)} alt={p.name} onClick={() => setModal(p)} />
                      <div>
                        <span className="tag">{p.tag}</span>
                        <h3 onClick={() => setModal(p)}>{p.name}</h3>
                        <p>{p.material} / {p.color}</p>
                        <div className="product-bottom"><strong>{money.format(p.price)}</strong><span>Eco {p.eco}%</span></div>
                        <div className="card-actions">
                          <button type="button" onClick={() => setModal(p)}>Подробнее</button>
                          {inCart > 0 ? (<div className="inline-qty"><button type="button" onClick={() => updateQty(p.id, -1)}>-</button><span>{inCart}</span><button type="button" onClick={() => updateQty(p.id, 1)}>+</button></div>) : (<button type="button" onClick={() => addToCart(p)}>В корзину</button>)}
                          <button className="coll-remove-btn" type="button" onClick={() => removeFromCollection(p.id)} title="Убрать из коллекции">✕</button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="site-footer"><div className="footer-brand">FORMA SPACE</div><p>Минимализм, честные материалы и умный подбор.</p></footer>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal product-modal animate-in" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setModal(null)}>✕</button>
            <img className="modal-img" src={getProductImage(modal)} alt={modal.name} />
            <div className="modal-body">
              <span className="tag">{modal.tag}</span>
              <h2>{modal.name}</h2>
              <p>{modal.description}</p>
              <div className="spec-grid">
                <span>{modal.width} x {modal.depth} x {modal.height} см</span>
                <span>{modal.material}</span>
                <span>Изготовление {modal.delivery} дней</span>
                <span>Eco {modal.eco}%</span>
              </div>
              <div className="modal-price">
                <strong>{money.format(modal.price)}</strong>
                {isLoggedIn && getCartQty(modal.id) > 0 ? (
                  <div className="inline-qty"><button type="button" onClick={() => updateQty(modal.id, -1)}>-</button><span>{getCartQty(modal.id)}</span><button type="button" onClick={() => updateQty(modal.id, 1)}>+</button></div>
                ) : isLoggedIn ? (
                  <button className="crud-save" type="button" onClick={() => addToCart(modal)}>В корзину</button>
                ) : null}
                {isLoggedIn && <button className={`modal-fav-btn ${favorites.includes(modal.id) ? 'active' : ''}`} type="button" onClick={() => toggleFavorite(modal.id)}>★</button>}
              </div>
              <div className="reviews-section">
                <strong>Отзывы</strong>
                {(() => {
                  const pr = reviews.filter((r) => r.productId === modal.id)
                  if (pr.length === 0) return <p className="reviews-empty">Отзывов пока нет.</p>
                  const avg = pr.reduce((s, r) => s + r.rating, 0) / pr.length
                  return <div className="reviews-summary">{avg.toFixed(1)} / 5 — {pr.length} {pr.length === 1 ? 'отзыв' : 'отзыва'}</div>
                })()}
                <div className="reviews-list">
                  {reviews.filter((r) => r.productId === modal.id).map((r) => (
                    <div className="review-card" key={r.id}>
                      <div className="review-header"><strong>{r.author}</strong><span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span><span className="review-date">{r.date}</span></div>
                      <p>{r.text}</p>
                      {getReviewImage(r) && <img className="review-photo" src={getReviewImage(r)} alt="Фото отзыва" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderSuccess && (
        <div className="modal-overlay" onClick={() => setOrderSuccess(false)}>
          <div className="modal success-modal animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon">✓</div>
            <h2>Заказ оформлен!</h2>
            <p>Спасибо за покупку. Подтверждение отправлено на email.</p>
            <button className="crud-save" type="button" onClick={() => setOrderSuccess(false)}>Закрыть</button>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
