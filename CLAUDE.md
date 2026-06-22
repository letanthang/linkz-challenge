# Project Overview
publc seat reservation app build with NextJS

# Tech Stack
- Language: Typescript 
- Framework: NextJS
- UI library shadcn
- Database: Mysql
- ORM: FrismaORM

# Architecture
- Clean Architecture . Dependency direction: Handler → Usecase → Repository.
- Modular Monolith
- Dependency Injection 
- SOLID principle

## Architecture Decision:
- other repositories must embed this base repo
````go

````


## Layer Structure
```

```

## What Goes Where
- Business rules / validations → `<module>/usecase/`
- DB queries → `infrastructure/persistence/`
- HTTP request/response mapping → `infrastructure/handler/`
- Entity definitions → `<module>/entity/`
- Repository interfaces → `<module>/repository/`
- Shared base repo / tx manager → `domain/repository/`

## Dependency Injection
Should user DI for most of things. Exception: Logger, Tracer(Opentelemetry, Promethus..) clients should be the only ones using Singleton