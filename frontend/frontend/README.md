# Manufacturing System Frontend

React + Tailwind frontend for the manufacturing system dashboard.

## Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

The frontend will run on `http://localhost:5173`

## Features

- ✅ React 18 with Vite
- ✅ Tailwind CSS for styling
- ✅ Recharts for data visualization
- ✅ React Router for navigation
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ API integration with backend
- ✅ Responsive design

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/         # Base UI components (Card, Button, etc.)
│   │   ├── sidebars/   # Role-specific sidebars
│   │   └── Header.jsx  # Top navigation header
│   ├── contexts/       # React contexts (Auth)
│   ├── layouts/        # Page layouts
│   ├── pages/          # Page components
│   │   ├── auth/       # Authentication pages
│   │   ├── admin/      # Admin pages
│   │   ├── operations/ # Operations pages
│   │   ├── inventory/  # Inventory pages
│   │   └── executive/  # Executive pages
│   └── utils/          # Utility functions (API, helpers)
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## API Integration

All API calls use the `apiGet`, `apiPost`, `apiPut`, `apiDelete` functions from `src/utils/api.js`.

The API base URL is configured in `.env` file.

## Development

```bash
npm run dev    # Start dev server
npm run build  # Build for production
npm run preview # Preview production build
```

## Environment Variables

- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:3001)
