# Code Structure Documentation

This document provides an overview of the source code structure of the Crawl4AI Server, explaining what each file does and how it's used in the system.

## Additional Documentation

- **[README.md](README.md)**: Technical documentation with setup instructions and configuration details.
- **[MCP_API.md](MCP_API.md)**: Detailed API endpoint specifications, JSON-RPC methods, request/response schemas, examples, and sequence diagrams.
- **[OVERVIEW.md](OVERVIEW.md)**: High-level architecture and conceptual overview.

## Root

- .github/
  : GitHub-specific configuration for CI/CD workflows, issue templates, and PR templates.
- .env
  : Environment variables for local development.
- .env-template
  : Template for environment variables configuration.
- .gitignore
  : Git ignore configuration.
- CODE_STRUCTURE.md
  : This file, documenting the code structure.
- CONTRIBUTING.md
  : Guidelines for contributing to the project.
- LICENSE.md
  : MIT License file.
- MCP_API.md
  : Detailed API documentation.
- OVERVIEW.md
  : High-level architecture and conceptual overview.
- README.md
  : Project overview and quick start guide.
- docker-compose.yml  
  : Defines development and production services and dependencies.
- crawl4ai-service/  
  : Service that performs web crawling tasks.
- mcp-service/  
  : MCP protocol server implementation.

## GitHub Configuration (.github/)

- ISSUE_TEMPLATE/
  - bug_report.md
    : Template for creating bug reports.
  - feature_request.md
    : Template for requesting new features.
- PULL_REQUEST_TEMPLATE.md
  : Template for creating pull requests.
- workflows/
  - ci.yml
    : GitHub Actions workflow for continuous integration.

## Crawl4AI Microservice (crawl4ai-service/)

- Dockerfile
  : Docker configuration for the standalone crawler microservice.
- package.json
  : Dependencies, scripts, and metadata specific to the microservice.
- tsconfig.json
  : TypeScript configuration scoped to the microservice codebase.
- src/
  - index.ts
    : Entry point for the microservice, initializes Express or HTTP transport.

## MCP Server (mcp-service/)

- Dockerfile
  : Multi-stage build for production image of the MCP server.
- package.json
  : MCP server dependencies, scripts, and metadata.
- tsconfig.json
  : TypeScript configuration for the MCP server.
- src/
  - index.ts
    : Entry point that bootstraps the Express server for MCP API.
  - controllers/
    - resourceController.ts
      : Implements endpoints for content crawling and retrieval.
    - toolController.ts
      : Exposes MCP tool invocation endpoints.
  - mcp/
    - SimpleMcpServer.ts
      : Implements MCP protocol logic and SSE handling.
  - server/
    - expressServer.ts
      : Express server configuration and middleware setup.
  - services/
    - configService.ts
      : Loads and validates configuration from environment variables.
    - crawlService.ts
      : Business logic for crawling and parsing web content.
  - types/
    - mcp.ts
      : TypeScript types for MCP messages and requests.
    - modelcontextprotocol.d.ts
      : MCP SDK TypeScript declarations.
