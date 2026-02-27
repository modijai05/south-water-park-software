# South Water Park Ticket Management System - Login Credentials

## Default Login Credentials

The system automatically seeds with default users when the server starts:

### Admin Accounts
- **Username**: `admin1` | **Password**: `admin1`
- **Username**: `admin2` | **Password**: `admin2`  
- **Username**: `admin3` | **Password**: `admin3`

### Staff Accounts
- **Username**: `staff1` | **Password**: `staff1`
- **Username**: `staff2` | **Password**: `staff2`
- **Username**: `staff3` | **Password**: `staff3`
- **Username**: `staff4` | **Password**: `staff4`
- **Username**: `staff5` | **Password**: `staff5`

## Access Levels

### Admin Users
- Full access to all features
- User management capabilities
- View all statistics and reports
- Manage ticket entries
- Create, edit, and delete users

### Staff Users
- Create and manage ticket entries
- View their own statistics
- Limited access to reports

## Getting Started

1. **Start the Server**: Run `npm run dev` in the `server` directory
2. **Start the Client**: Run `npm run dev` in the `client` directory  
3. **Login**: Use any of the credentials above to access the system
4. **Database**: The system uses MongoDB Atlas for persistent data storage with zero data loss

## Security Notes

- Passwords are hashed using bcrypt
- JWT tokens expire after 7 days
- All API endpoints require authentication
- Admin-only routes are protected with role-based access control

## Troubleshooting

If you encounter 401 Unauthorized errors:
1. Make sure the server is running and connected to MongoDB Atlas
2. Check that you're using correct credentials
3. Verify MongoDB Atlas connection is active
4. The database automatically seeds with default users on first startup

## User Management

Admin users can:
- Create new users with custom credentials
- Edit existing user information (username, email, full name, role)
- Reset passwords for any user
- Activate/deactivate user accounts
- View user login logs and statistics

The user management interface is available in the Admin Dashboard under the "Manage Users" section.
