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

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `PORT`
- `CORS_ALLOWED_ORIGINS`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `S3_ENABLED`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_ENDPOINT`
- `S3_REVIEW_VIDEO_PREFIX`
- `S3_PRESIGNED_URL_MINUTES`

Example:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/squat_map?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul"
$env:SPRING_DATASOURCE_USERNAME="root"
$env:SPRING_DATASOURCE_PASSWORD="password"
$env:CORS_ALLOWED_ORIGINS="http://43.201.61.156"
$env:ADMIN_BOOTSTRAP_USERNAME="admin"
$env:ADMIN_BOOTSTRAP_PASSWORD="change-me"
$env:S3_ENABLED="true"
$env:S3_REGION="ap-northeast-2"
$env:S3_BUCKET="your-squat-map-bucket"
$env:S3_ACCESS_KEY="AKIA..."
$env:S3_SECRET_KEY="..."
.\gradlew.bat bootRun
```

For EC2 with `systemd`, copy [`.env.example`](E:\Project\squat-map\backend\.env.example) to `.env` on the server, set the real secrets there, and point your service to it with `EnvironmentFile=/home/ec2-user/app/.env`. A service template is included at [`deploy/routinehub.service.example`](E:\Project\squat-map\deploy\routinehub.service.example).

## API

- `GET /api/health`
- `GET /api/records`
- `POST /api/records`
- `POST /api/records/{recordId}/review-video`
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
- Review video binary: `S3`
- Review video metadata: `review_videos` table
- Admin queue response returns presigned S3 video URLs for playback

## Review Video Flow

1. Record creation checks whether the new record entered the national Top 5.
2. If it did, the backend creates or reopens a pending review-queue item.
3. The frontend uploads the associated verification video with `POST /api/records/{recordId}/review-video`.
4. The backend stores the file in S3 and saves object metadata in `review_videos`.
5. Admin review queue responses include a presigned playback URL.
6. Approve/reject/delete operations remove the S3 object and the metadata row.

## Nginx

Nginx examples are included in:

- `../deploy/nginx/squat-map.conf`
- `../deploy/nginx/squat-map-ssl.conf`

Recommended production structure on AWS EC2:

- Frontend static files: `/var/www/squat-map/dist`
- Spring Boot backend: `127.0.0.1:8080`
- Nginx: public entrypoint on `80/443`

The provided config serves the Vite build, proxies `/api/*` to Spring Boot, supports SPA routing with `try_files ... /index.html`, and caches static assets.
