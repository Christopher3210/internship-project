# Postman API checks

Postman is an API client: it sends HTTP requests to the backend and runs assertions against each response. This starter collection contains safe, read-only checks; it does not create, update, or delete database records.

## Import

1. Start PostgreSQL and the NestJS backend (`npm.cmd run start:dev` in `bknd`).
2. In Postman, choose **Import** and import both `Internship-Admin-API-ReadOnly.postman_collection.json` and `Local.postman_environment.json`.
3. Select the `Internship Admin API - Local` environment.
4. Run the collection, or run individual GET requests. The environment's `baseUrl` points to `http://localhost:3001`.

The collection checks status codes, JSON/body shape, important fields, calculations, and response time. `maxResponseTimeMs` is an initial local target (3000 ms), not a production SLA; adjust it after agreeing a target with the team.

## Write and validation tests

Import `Internship-Admin-API-Write-Validation.postman_collection.json` as a second collection. Keep the `Internship Admin API - Local` environment selected and run the collection in order.

This collection covers sign-up/login validation, user create/update/delete, and company create/update/delete. It generates timestamped test accounts and a `PMTEST...` company code. The final user request removes the two test accounts; the company request deletes the generated company. These requests are designed for the local development database only. Do not point this collection at a shared or production database.

The runner's **Stop run if an error occurs** option should be off so the collection reaches cleanup even if an assertion fails. If a run is interrupted before cleanup, use the generated `testSignupEmail`, `testCrudUserEmail`, or `testCompanyCode` environment values to locate and remove only the leftover Postman test records.
