# Computer Laboratory Inventory and Maintenance Management System

**Cabiao Senior High School**

A fully functional, open-source web application for managing computer laboratory equipment inventory, tracking maintenance, and generating reports.

## Features

- **User Authentication & RBAC** - Admin, Custodian, and Technician roles
- **Equipment Inventory Management** - Full CRUD with asset tracking, serial numbers, lab assignments
- **Maintenance Ticket System** - Report issues, assign technicians, track resolution
- **Maintenance Logs** - Track repairs, parts replacements, and servicing history
- **Analytical Dashboard** - Visual stats on assets, defects, and ticket status
- **Report Export** - CSV and PDF export of equipment inventory
- **Laboratory Management** - View labs and their equipment counts

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | HTML5, CSS3, Alpine.js, Tailwind-inspired CSS |
| Backend | Node.js, Express.js |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT (JSON Web Tokens) |
| Passwords | bcryptjs |

## Project Structure

```
lab-inventory-system/
├── .env                          # Environment variables
├── package.json                  # Dependencies
├── README.md
├── data/                         # SQLite database (auto-created)
├── public/                       # Frontend static files
│   ├── index.html                # SPA entry point
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js                # API client
│       └── app.js                # Alpine.js init
└── server/
    ├── server.js                 # Express server entry
    ├── database.js               # DB schema & connection
    ├── seed.js                   # Sample data seeder
    ├── middleware/
    │   └── auth.js               # JWT auth middleware
    └── routes/
        ├── auth.js               # Login, user management
        ├── equipment.js          # Equipment CRUD & reports
        ├── tickets.js            # Maintenance tickets
        ├── labs.js               # Laboratories
        ├── categories.js         # Equipment categories
        └── maintenance.js        # Maintenance logs
```

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Steps

```bash
# 1. Navigate to project directory
cd lab-inventory-system

# 2. Install dependencies
npm install

# 3. Initialize the database
npm run init-db

# 4. Seed sample data (optional but recommended)
npm run seed

# 5. Start the server
npm start
```

The application will be available at: **http://localhost:3000**

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| System Admin | admin@chs.edu.ph | admin123 |
| Custodian | custodian@chs.edu.ph | custodian123 |
| Technician | tech@chs.edu.ph | tech123 |

## Role Permissions

| Feature | Admin | Custodian | Technician |
|---------|-------|-----------|------------|
| View Dashboard | ✓ | ✓ | ✓ |
| View Equipment | ✓ | ✓ | ✓ |
| Add/Edit/Delete Equipment | ✓ | ✓ | - |
| Create Maintenance Tickets | - | ✓ | - |
| Update Ticket Status | ✓ | - | ✓ |
| Add Maintenance Logs | - | - | ✓ |
| Export Reports | ✓ | ✓ | ✓ |
| View Labs | ✓ | ✓ | ✓ |

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/change-password` - Change password
- `GET /api/auth/users` - List all users

### Equipment
- `GET /api/equipment` - List equipment (supports filtering)
- `GET /api/equipment/stats` - Dashboard statistics
- `GET /api/equipment/:id` - Get single equipment with maintenance history
- `POST /api/equipment` - Add new equipment
- `PUT /api/equipment/:id` - Update equipment
- `DELETE /api/equipment/:id` - Delete equipment
- `GET /api/equipment/export/csv` - Export as CSV
- `GET /api/equipment/export/pdf` - Export as PDF

### Tickets
- `GET /api/tickets` - List tickets
- `GET /api/tickets/:id` - Get single ticket
- `POST /api/tickets` - Create ticket
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/logs` - Add maintenance log to ticket

### Other
- `GET /api/labs` - List laboratories
- `GET /api/categories` - List equipment categories
- `GET /api/maintenance` - List maintenance logs
- `POST /api/maintenance` - Add maintenance log

## License

MIT License

## Author

Mariane Jane Parulan Gatbunton
