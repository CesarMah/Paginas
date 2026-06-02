# GastroFlow

Plataforma SaaS B2B para restaurantes, cafeterías y dark kitchens en México.

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript + Tailwind CSS
- **Backend**: AWS Lambda (Node.js 20, ARM64) + API Gateway
- **Base de datos**: PostgreSQL 15 (Amazon RDS + RDS Proxy)
- **Auth**: Amazon Cognito User Pools
- **IaC**: AWS CDK v2 (TypeScript)

## Requisitos

- Node.js >= 20
- pnpm >= 9
- AWS CLI configurado
- AWS CDK v2 instalado globalmente

## Setup local

```bash
pnpm install
cp .env.example .env
# Llenar las variables de entorno
```

## Comandos

```bash
pnpm dev           # Inicia el frontend en modo desarrollo
pnpm test          # Corre todos los tests
pnpm lint          # Linting en todo el proyecto
pnpm deploy:dev    # Deploy al entorno dev
pnpm deploy:prod   # Deploy al entorno prod (requiere aprobación)
```

## Secretos requeridos en GitHub Actions

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

## Migraciones de DB

```bash
flyway -url=jdbc:postgresql://... -user=... -password=... migrate
```

---

*GastroFlow Tech Spec v1.0 — Julio César Martínez Hernández — Junio 2026*
