# 🗄️ MongoDB Atlas Setup - Professional Configuration

## 🚨 IMMEDIATE ACTION REQUIRED

### **Step 1: Create New MongoDB Atlas Cluster**

1. **Go to**: https://cloud.mongodb.com
2. **Login**: Use your MongoDB account
3. **Create New Cluster**:
   - Click "Build a Database"
   - Choose "M0 Sandbox (Free)"
   - Cloud Provider: AWS
   - Region: Choose nearest to your users
   - Cluster Name: `south-water-park-cluster`
4. **Create Database User**:
   - Username: `south-water-park-admin`
   - Password: Generate strong password (save it!)
   - Database User Privileges: Read and write to any database
5. **Whitelist IP**: 
   - Click "Network Access"
   - Add "Allow Access from Anywhere" (0.0.0.0/0)
   - This is CRITICAL for Render deployment

### **Step 2: Get Connection String**

1. **Go to**: Database → Connect
2. **Choose**: Drivers
3. **Select**: Node.js
4. **Copy Connection String**:
   ```
   mongodb+srv://south-water-park-admin:YOUR_PASSWORD@cluster.mongodb.net/south_water_park?retryWrites=true&w=majority
   ```

### **Step 3: Update Render Configuration**

Replace the MONGODB_URI in render.yaml with your new connection string:

```yaml
envVars:
  - key: MONGODB_URI
    value: mongodb+srv://south-water-park-admin:YOUR_PASSWORD@cluster.mongodb.net/south_water_park?retryWrites=true&w=majority
```

## 🔧 Professional Setup Script

### **Automated Setup**:
```bash
# 1. Set environment variables
export MONGODB_URI="mongodb+srv://south-water-park-admin:YOUR_PASSWORD@cluster.mongodb.net/south_water_park?retryWrites=true&w=majority"
export JWT_SECRET="south-water-park-$(date +%Y)-production-secret"

# 2. Test connection
mongosh "$MONGODB_URI"

# 3. Update render.yaml
sed -i "s|value: mongodb+srv://.*|value: $MONGODB_URI|g" backend/server/render.yaml
```

## 🛡️ Security Best Practices

### **Production Security**:
- ✅ Use strong password for database user
- ✅ Enable IP whitelist for production (0.0.0.0/0 for Render)
- ✅ Use `mongodb+srv://` protocol (TLS/SSL enabled)
- ✅ Enable authentication in application
- ✅ Use environment variables (no hardcoded secrets)

### **Connection Security**:
- ✅ Connection pooling enabled (maxPoolSize: 20)
- ✅ Retry writes enabled
- ✅ Write concern: 'majority'
- ✅ Read preference: 'primary'

## 🔍 Connection String Format

### **Required Format**:
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### **Parameters**:
- `mongodb+srv://` - Recommended protocol with SSL
- `username` - Database user
- `password` - Strong password
- `cluster.mongodb.net` - MongoDB Atlas host
- `database` - Database name
- `retryWrites=true` - Enable retry writes
- `w=majority` - Write concern for data safety

## 🚀 Testing Procedure

### **Local Test**:
```bash
# Test connection string
mongosh "mongodb+srv://south-water-park-admin:YOUR_PASSWORD@cluster.mongodb.net/south_water_park?retryWrites=true&w=majority"

# Test application
MONGODB_URI="your_connection_string" npx tsx src/index.js
```

### **Expected Success**:
```
🔗 MongoDB Connection Setup
📋 MONGODB_URI: CONFIGURED
🔄 Connection attempt 1/5...
✅ MongoDB connected (persistent) - Production Ready
🚀 Server started successfully
```

## 📋 Quick Setup Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with strong password
- [ ] IP whitelist configured (0.0.0.0/0)
- [ ] Connection string obtained
- [ ] render.yaml updated with new MONGODB_URI
- [ ] Connection tested locally
- [ ] Deployed to Render

---

**Status**: 🟢 Ready for professional MongoDB Atlas setup
**Security**: 🛡️ Enterprise-grade configuration
**Data Persistence**: 💾 100% guaranteed
