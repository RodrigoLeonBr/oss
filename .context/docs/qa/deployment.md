---
slug: deployment
category: operations
generatedAt: 2026-04-13T02:41:48.518Z
relevantFiles:
  - Dockerfile
---

# How do I deploy this project?

## Deployment

### Docker

This project includes Docker configuration.

```bash
docker build -t app .
docker run -p 3000:3000 app
```
