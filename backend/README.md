# Squat Map Backend

Spring Boot 3.5 + Java 17 backend for Squat Map.

## Run

```bash
./gradlew bootRun
```

Windows:

```powershell
.\gradlew.bat bootRun
```

## Environment Variables

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `PORT`
- `CORS_ALLOWED_ORIGINS`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

Example:

```powershell
$env:DB_URL="jdbc:mysql://localhost:3306/squat_map?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="password"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173"
$env:ADMIN_BOOTSTRAP_USERNAME="admin"
$env:ADMIN_BOOTSTRAP_PASSWORD="change-me"
.\gradlew.bat bootRun
```

## API

- `GET /api/health`
- `GET /api/records`
- `POST /api/records`
- `DELETE /api/records/{recordId}`
- `GET /api/rankings`
- `POST /api/admin/auth/login`
- `GET /api/admin/review-queue`
- `POST /api/admin/review-queue`
- `POST /api/admin/review-queue/{recordId}/approve`
- `POST /api/admin/review-queue/{recordId}/reject`
- `DELETE /api/admin/review-queue/{recordId}`

## Current Auth Model

Admin-only endpoints currently use request headers:

- `X-Admin-Username`
- `X-Admin-Password`

This is a bootstrap-friendly server-side check for early integration. For production on AWS, replace it with JWT or session-based auth before opening the service publicly.

## Storage Model

- Records, rankings, review queue metadata: `RDS`
- Review video binary itself: not implemented here
- Recommended production path for video: `S3` + metadata in `review_videos`

## Nginx

Nginx examples are included in:

- `../deploy/nginx/squat-map.conf`
- `../deploy/nginx/squat-map-ssl.conf`

Recommended production structure on AWS EC2:

- Frontend static files: `/var/www/squat-map/dist`
- Spring Boot backend: `127.0.0.1:8080`
- Nginx: public entrypoint on `80/443`

The provided config serves the Vite build, proxies `/api/*` to Spring Boot, supports SPA routing with `try_files ... /index.html`, and caches static assets.
