# Aplikasi Management Data Token

Aplikasi manajemen data token yang dibangun dengan Next.js 15, Firebase, Tailwind CSS, dan shadcn/ui.

## 🚀 Fitur Utama

- ✅ **Authentication**: Login/Register dengan Firebase Auth
- ✅ **Dashboard**: Interface modern dengan shadcn/ui components
- ✅ **Token Management**: Manajemen data token dengan Firestore
- ✅ **Responsive Design**: UI yang responsif dengan Tailwind CSS
- ✅ **TypeScript**: Full TypeScript support
- ✅ **AI Integration**: Genkit AI untuk fitur cerdas

## 🛠️ Tech Stack

- **Framework**: Next.js 15 dengan App Router
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript
- **AI**: Google Genkit
- **Deployment**: Vercel

## 📦 Installation

1. Clone repository:
```bash
git clone <repository-url>
cd Firebase_Token_final2
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env.local
```
Edit `.env.local` dengan konfigurasi Firebase Anda.

4. Run development server:
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:9002`

## 🚀 Deployment ke Vercel

### Persiapan Deploy

1. **Build Test**: Pastikan aplikasi dapat di-build tanpa error
```bash
npm run build
```

2. **Environment Variables**: Setup di Vercel dashboard:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### Deploy Steps

1. **Via Vercel CLI**:
```bash
npm i -g vercel
vercel
```

2. **Via GitHub Integration**:
   - Push ke GitHub repository
   - Connect repository di Vercel dashboard
   - Deploy otomatis

3. **Manual Deploy**:
   - Upload project ke Vercel dashboard
   - Configure environment variables
   - Deploy

## 📁 Project Structure

```
src/
├── app/                 # App Router pages
│   ├── (app)/          # Protected app routes
│   ├── (auth)/         # Authentication pages
│   └── api/            # API routes
├── components/         # React components
│   ├── ui/            # shadcn/ui components
│   ├── auth/          # Auth components
│   └── dashboard/     # Dashboard components
├── config/            # Configuration files
├── contexts/          # React contexts
├── hooks/             # Custom hooks
├── lib/               # Utility functions
└── types/             # TypeScript types
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript check
- `npm run genkit:dev` - Start Genkit development

## 🔒 Security

- Environment variables untuk sensitive data
- Firebase Security Rules
- TypeScript untuk type safety
- ESLint untuk code quality

## 📝 Notes

- Aplikasi menggunakan Next.js 15 dengan App Router
- Firebase configuration sudah disetup
- Tailwind CSS + shadcn/ui untuk styling
- TypeScript untuk development yang lebih aman
- Vercel configuration sudah siap untuk deployment

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request
