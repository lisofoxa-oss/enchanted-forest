# 🌲 Зачарованный Лес

Настольная игра-приключение для двоих. React + Firebase.

---

## Быстрый старт: 3 шага до деплоя

### Шаг 1. Создай Firebase проект (бесплатно, 2 минуты)

1. Открой **https://console.firebase.google.com**
2. Нажми **"Create a project"** → назови как угодно → создай
3. В левом меню нажми **"Build" → "Realtime Database"**
4. Нажми **"Create Database"** → выбери регион (любой) → **"Start in test mode"** → создай
5. Теперь добавь веб-приложение:  
   — Нажми шестерёнку ⚙️ → **"Project settings"**  
   — Внизу нажми **"Add app"** → выбери веб `</>`  
   — Назови как угодно → **"Register app"**  
   — **Скопируй блок `firebaseConfig`** — он тебе нужен!

### Шаг 2. Вставь конфиг в проект

Открой файл `src/firebase.js` и замени плейсхолдеры своими данными:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "myproject-12345.firebaseapp.com",
  databaseURL: "https://myproject-12345-default-rtdb.firebaseio.com",
  projectId: "myproject-12345",
  storageBucket: "myproject-12345.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Шаг 3. Задеплой на Vercel (самый простой способ)

**Вариант A — через GitHub (рекомендуется):**

```bash
# Создай репозиторий на github.com, затем:
git init
git add .
git commit -m "enchanted forest"
git remote add origin https://github.com/ТВОЙ_ЮЗЕРНЕЙМ/enchanted-forest.git
git push -u origin main
```

Потом:
1. Зайди на **https://vercel.com** → залогинься через GitHub
2. Нажми **"Add New" → "Project"**
3. Выбери свой репозиторий `enchanted-forest`
4. Vercel автоматически определит Vite → нажми **"Deploy"**
5. Через минуту получишь ссылку типа `enchanted-forest.vercel.app`

**Вариант B — через Vercel CLI:**

```bash
npm i -g vercel
vercel
```

Следуй инструкциям, получишь ссылку.

---

## Как играть

1. Открой ссылку на двух устройствах
2. Один игрок нажимает **"Алиса"**, другой — **"Алёша"**
3. Когда оба подключились — игра стартует
4. Бросаете кубик по очереди, двигаетесь по карте
5. Кто первый дойдёт до Дракона и победит — выигрывает!

---

## Локальная разработка

```bash
npm install
npm run dev
```

Откроется на `http://localhost:5173`
