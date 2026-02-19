# The South Water Park – Customer Ticket Entry System

Full-stack, production-ready ticket entry system with role-based access (Admin / Staff), futuristic gradient blue UI, and full CRUD + export.

## Tech Stack

- **Frontend:** React (Vite), TypeScript, Tailwind CSS, Framer Motion, Recharts, React Hook Form + Zod, ExcelJS, Day.js, Zustand
- **Backend:** Node.js, Express, MongoDB, Mongoose, JWT, role-based middleware

## Project Structure

```
south-water-park/
├── frontend/
│   └── client/                 # React frontend application
│       ├── src/
│       │   ├── components/      # Reusable UI components
│       │   ├── pages/          # Application pages
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # Utility functions and API calls
│       │   ├── store/          # State management (Zustand)
│       │   └── types/          # TypeScript type definitions
│       ├── public/              # Static assets
│       ├── package.json
│       └── vite.config.ts      # Vite configuration
├── backend/
│   └── server/                 # Node.js backend API
│       ├── src/
│       │   ├── middleware/      # Express middleware
│       │   ├── models/         # MongoDB models
│       │   ├── routes/         # API routes
│       │   ├── utils/          # Utility functions
│       │   └── scripts/        # Database scripts
│       ├── package.json
│       └── tsconfig.json       # TypeScript configuration
├── docker-compose.yml           # Docker development setup
├── package.json               # Root package configuration
└── README.md                  # This file
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB 7.0+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd south-water-park
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   
   Create `.env` files in both frontend and backend directories:
   
   **Backend (backend/server/.env):**
   ```bash
   NODE_ENV=development
   PORT=8000
   MONGODB_URI=mongodb://localhost:27017/south_water_park
   JWT_SECRET=your-super-secret-jwt-key
   ```
   
   **Frontend (frontend/client/.env):**
   ```bash
   VITE_API_URL=http://localhost:8000
   ```

4. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:7.0
   
   # Or start local MongoDB service
   mongod
   ```

5. **Run the application**
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start individually
   npm run dev:frontend  # Frontend on http://localhost:5174
   npm run dev:backend   # Backend on http://localhost:8000
   ```

## Docker Setup

For complete containerized development:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

This will start:
- MongoDB on port 27017
- Backend API on port 8000
- Frontend on port 5174

## Available Scripts

### Root Level Scripts
- `npm run dev` - Start both frontend and backend in development
- `npm run build` - Build both frontend and backend for production
- `npm run start` - Start production backend server
- `npm run install:all` - Install dependencies for all packages
- `npm run lint` - Lint both frontend and backend code
- `npm run clean` - Clean all node_modules

### Frontend Scripts (cd frontend/client)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend Scripts (cd backend/server)
- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Technologies Used

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Router** - Navigation
- **React Hook Form** - Form handling
- **Chart.js & Recharts** - Data visualization
- **ExcelJS** - Excel export functionality

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **cors** - Cross-origin resource sharing

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Features

### Customer-Facing
- **Ticket Booking** - Online ticket purchase with multiple ticket types
- **Payment Processing** - Support for cash, UPI, and advance payments
- **Receipt Generation** - Digital and printable receipts
- **Real-time Pricing** - Dynamic ticket pricing based on configuration

### Admin Dashboard
- **User Management** - Staff and admin user accounts
- **Ticket Configuration** - Dynamic pricing and ticket type management
- **Entry Management** - View, edit, and manage customer entries
- **Analytics** - Comprehensive reporting and data visualization
- **Export Functionality** - Excel export for all data
- **Real-time Updates** - Live synchronization across all admin sections

### System Features
- **Authentication & Authorization** - Secure login system
- **Data Validation** - Input validation and error handling
- **Responsive Design** - Mobile-friendly interface
- **Error Handling** - Comprehensive error management
- **Logging** - Detailed system logging

## Configuration

### Environment Variables

#### Backend (.env)
```bash
NODE_ENV=development
PORT=8000
MONGODB_URI=mongodb://localhost:27017/south_water_park
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

#### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8000
```

### Database Setup

1. **Install MongoDB**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # macOS
   brew install mongodb-community
   
   # Windows
   # Download and install from MongoDB website
   ```

2. **Create Database**
   The application will automatically create the `south_water_park` database on first run.

3. **Seed Data**
   Default ticket configurations and admin user are created automatically.

## Deployment

### Production Build

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Environment-Specific Configurations

- **Development**: Hot reload, detailed logging
- **Production**: Optimized builds, error logging only
- **Testing**: Test database, mock services

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Email: support@southwaterpark.com
- Documentation: Check the `/docs` directory
- Issues: Create an issue on GitHub

## Version History

- **v1.0.0** - Initial release with complete ticketing and admin system
- **v1.1.0** - Added advanced analytics and reporting
- **v1.2.0** - Enhanced mobile responsiveness and performance optimizations

---

Built with ❤️ for South Water Park

## Default Users (after seed)

| Username | Password | Role  |
|----------|----------|-------|
| admin1   | admin1   | Admin |
| admin2   | admin2   | Admin |
| admin3   | admin3   | Admin |
| staff1   | staff1   | Staff |
| staff2   | staff2   | Staff |
| staff3   | staff3   | Staff |
| staff4   | staff4   | Staff |
| staff5   | staff5   | Staff |
