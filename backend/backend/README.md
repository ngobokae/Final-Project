# Node.js Backend

Pure Node.js backend (NO Express) for the manufacturing system.

## Features

- ✅ Pure Node.js (built-in modules only)
- ✅ JWT authentication
- ✅ Role-based access control (RBAC)
- ✅ MySQL database integration
- ✅ RESTful API
- ✅ Audit logging
- ✅ Secure API communication with ML service

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your database credentials
npm start
```

## Environment Variables

See `.env.example` for all available options.

## API Endpoints

See main `README.md` for complete API documentation.

## Development

```bash
npm run dev  # Auto-reload on changes
```

## Architecture

- `server.js`: Main HTTP server
- `config/`: Configuration files
- `middleware/`: Authentication and authorization
- `routes/`: API route handlers
- `utils/`: Helper functions

## Security

- JWT token authentication
- Password hashing (bcrypt)
- SQL injection prevention
- CORS configuration
- Input validation
