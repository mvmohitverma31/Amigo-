# Production Deployment Guide — Amigo

## Prerequisites

- Domain name (e.g., amigo.app)
- VPS or cloud server (Ubuntu 22.04+, 2GB RAM minimum)
- SSL certificate (Let's Encrypt)
- Docker & Docker Compose installed
- PostgreSQL 15+ (or use Docker container)
- Redis 7+ (or use Docker container)

---

## Step 1: Server Setup

### 1.1 Initial Server Configuration

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Configure firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 1.2 Create Application Directory

```bash
mkdir -p /opt/amigo
cd /opt/amigo
```

---

## Step 2: Environment Configuration

### 2.1 Create Production .env File

```bash
nano .env
```

**Required variables:**

```env
# Database
DB_USER=amigo_prod
DB_PASSWORD=<generate-strong-password-64-chars>
DB_NAME=amigo

# Redis
REDIS_PASSWORD=<generate-strong-password-32-chars>

# JWT (CRITICAL: Use a strong random key)
JWT_SECRET_KEY=<generate-64-random-bytes>

# CORS (your frontend domain)
CORS_ORIGINS=["https://amigo.app", "https://www.amigo.app"]

# Allowed hosts
ALLOWED_HOSTS=["amigo.app", "api.amigo.app", "www.amigo.app"]

# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
```

**Generate secure passwords:**

```bash
# Database password (64 chars)
openssl rand -base64 48

# Redis password (32 chars)
openssl rand -base64 24

# JWT secret (64 chars)
openssl rand -base64 48
```

**⚠️ CRITICAL:** Never commit `.env` to git. Add it to `.gitignore`.

---

## Step 3: SSL Certificate

### 3.1 Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 3.2 Get Certificate

```bash
# Stop nginx if running
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone -d amigo.app -d www.amigo.app -d api.amigo.app

# Certificates will be in /etc/letsencrypt/live/
```

### 3.3 Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up cron for renewal
```

---

## Step 4: Nginx Configuration

### 4.1 Create nginx.conf

```bash
nano nginx.conf
```

```nginx
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name amigo.app www.amigo.app api.amigo.app;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS - Frontend
    server {
        listen 443 ssl http2;
        server_name amigo.app www.amigo.app;

        ssl_certificate /etc/letsencrypt/live/amigo.app/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/amigo.app/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Frontend static files
        location / {
            root /var/www/amigo/dist;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
    }

    # HTTPS - API
    server {
        listen 443 ssl http2;
        server_name api.amigo.app;

        ssl_certificate /etc/letsencrypt/live/amigo.app/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/amigo.app/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # API rate limiting
        location /api/v1/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check (no rate limit)
        location /health {
            proxy_pass http://backend:8000;
        }
    }
}
```

---

## Step 5: Deploy Backend

### 5.1 Clone Repository

```bash
cd /opt/amigo
git clone <your-repo-url> .
```

### 5.2 Build and Start

```bash
cd backend

# Build Docker image
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f backend
```

### 5.3 Verify Deployment

```bash
# Check health
curl https://api.amigo.app/health

# Expected response:
# {"status":"healthy","database":"connected","version":"1.0.0"}
```

---

## Step 6: Deploy Frontend

### 6.1 Build Frontend

```bash
cd /opt/amigo
npm install
npm run build
```

### 6.2 Copy to Nginx

```bash
sudo mkdir -p /var/www/amigo
sudo cp -r dist/* /var/www/amigo/
sudo chown -R www-data:www-data /var/www/amigo
```

### 6.3 Start Nginx

```bash
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

---

## Step 7: Database Backup

### 7.1 Create Backup Script

```bash
nano /opt/amigo/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/amigo/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec amigo-db pg_dump -U postgres amigo > $BACKUP_DIR/db_$TIMESTAMP.sql

# Compress
gzip $BACKUP_DIR/db_$TIMESTAMP.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/db_$TIMESTAMP.sql.gz"
```

```bash
chmod +x /opt/amigo/backup.sh
```

### 7.2 Schedule Daily Backup

```bash
crontab -e
```

Add:
```
0 2 * * * /opt/amigo/backup.sh >> /var/log/amigo-backup.log 2>&1
```

---

## Step 8: Monitoring

### 8.1 Install Monitoring Tools

```bash
# Install htop for resource monitoring
sudo apt install htop -y

# Install fail2ban for brute force protection
sudo apt install fail2ban -y
```

### 8.2 Configure Log Rotation

```bash
sudo nano /etc/logrotate.d/amigo
```

```
/opt/amigo/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

### 8.3 Set Up Alerts

Monitor these metrics:
- CPU usage (>80% for 5 min)
- Memory usage (>90%)
- Disk usage (>85%)
- Failed login attempts (>10/hour)
- API error rate (>5%)

---

## Step 9: Security Hardening

### 9.1 Disable Root SSH Login

```bash
sudo nano /etc/ssh/sshd_config
```

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
sudo systemctl restart ssh
```

### 9.2 Configure fail2ban

```bash
sudo nano /etc/fail2ban/jail.local
```

```
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
```

```bash
sudo systemctl restart fail2ban
```

### 9.3 Regular Security Updates

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Step 10: Testing

### 10.1 Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils -y

# Test API (100 requests, 10 concurrent)
ab -n 100 -c 10 https://api.amigo.app/health

# Expected: <500ms response time, 0% errors
```

### 10.2 Security Scanning

```bash
# SSL Labs test
curl https://www.ssllabs.com/ssltest/analyze.html?d=api.amigo.app

# OWASP ZAP (automated security scan)
# Download from: https://www.zaproxy.org/
```

---

## Step 11: Go Live

### 11.1 Final Checklist

- [ ] All environment variables set
- [ ] SSL certificate valid
- [ ] Database backup working
- [ ] Logs rotating correctly
- [ ] Rate limiting active
- [ ] CORS configured correctly
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] Monitoring in place
- [ ] Backup schedule active

### 11.2 DNS Configuration

Point your domain to the server IP:

```
amigo.app       A    <server-ip>
www.amigo.app   CNAME amigo.app
api.amigo.app   CNAME amigo.app
```

### 11.3 Launch

```bash
# Verify everything is running
docker-compose ps
curl https://api.amigo.app/health
curl https://amigo.app

# Monitor logs
docker-compose logs -f
```

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Database not ready: Wait for healthcheck
# - Invalid JWT_SECRET_KEY: Must be 32+ chars
# - Missing .env: Copy from .env.example
```

### 502 Bad Gateway

```bash
# Check if backend is running
docker-compose ps

# Restart backend
docker-compose restart backend

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Database connection failed

```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker exec -it amigo-db psql -U postgres -d amigo
```

---

## Maintenance

### Weekly Tasks
- [ ] Review logs for errors
- [ ] Check disk space
- [ ] Verify backups completed

### Monthly Tasks
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Test restore from backup
- [ ] Check SSL certificate expiry

### Quarterly Tasks
- [ ] Full security audit
- [ ] Performance review
- [ ] Capacity planning
- [ ] Disaster recovery test

---

## Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Review documentation: `docs/ARCHITECTURE.md`
3. Check security audit: `docs/SECURITY_AUDIT.md`
4. Review this guide for troubleshooting

---

**Deployment complete! Your Amigo application is now live and secure.** 🚀
