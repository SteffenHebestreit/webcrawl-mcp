# Code Structure Documentation

This document provides an overview of the source code structure of the MCP-Server-Template, explaining what each file does and how it's used in the system.

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
- package.json
  : Root package with workspace configuration for managing the monorepo.
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

## MCP Server (mcp-service/)

- Dockerfile
  : Multi-stage build for production image of the MCP server.
- package.json
  : MCP server dependencies, scripts, and metadata.
- tsconfig.json
  : TypeScript configuration for the MCP server.
- tsconfig.node.json
  : Node.js-specific TypeScript configuration for better module resolution.
- src/
  - index.ts
    : Entry point that bootstraps the unified server.

### Configuration (src/config/)

- index.ts
  : Main configuration entry point that combines all configuration modules.
- appConfig.ts
  : Core application settings like port, environment, and logging.
- mcpConfig.ts
  : MCP server specific settings for name, version, and description.
- securityConfig.ts
  : Security-related settings for CORS and rate limiting.
- crawlConfig.ts
  : Web crawling settings for page limits, depth, and strategies.
- utils.ts
  : Utility functions for parsing environment variables.

### Controllers (src/controllers/)

- resourceController.ts
  : Implements endpoints for resource management with the new config structure.
- toolController.ts
  : Exposes MCP tool invocation endpoints with Joi validation.

### MCP Implementation (src/mcp/)

- SimpleMcpServer.ts
  : Implements MCP protocol logic and SSE handling with the new config structure.

### Routes (src/routes/)

- apiRoutes.ts
  : Defines general API endpoints like health checks and version info.
- mcpRoutes.ts
  : Defines MCP-specific endpoints for SSE connections.

### Server (src/server/)

- server.ts
  : Unified server implementation that integrates Express and MCP capabilities.

### Services (src/services/)

- crawlExecutionService.ts
  : Business logic for web crawling operations.

### Types (src/types/)

- mcp.ts
  : MCP type definitions and interfaces.
- modelcontextprotocol.d.ts
  : MCP SDK type declarations.
- module.d.ts
  : Module declarations for external libraries.

### Utilities (src/utils/)

- logger.ts
  : Logging utilities and configuration.
- requestLogger.ts
  : HTTP request logging middleware.
- schemaConverter.ts
  : Converts Joi validation schemas to JSON Schema format for MCP compliance.
  : Provides dedicated schema generators for crawl and crawlWithMarkdown tools.
  : Enhances MCP compatibility with standardized parameter schemas.
  : Implements joiToJsonSchema utility and tool-specific schema generators.

### Tests (src/test/)

- mcp-compliance-test.ts
  : Comprehensive MCP compliance testing suite.
- mcp-compliance-test-simple.ts
  : Simplified MCP compliance tests.

### Services (src/services/)

- crawlExecutionService.ts
  : Advanced web crawling service with Puppeteer integration. Features include:
    - **Browser Management**: Robust browser initialization with error handling and custom executable path support
    - **Content Extraction**: Text extraction, HTML-to-Markdown conversion, and table extraction
    - **Multiple Crawling Strategies**: BFS, DFS, and best-first search algorithms
    - **Advanced Features**: Screenshot capture, network traffic monitoring, and multi-page crawling
    - **Error Resilience**: Comprehensive error handling, timeout management, and connection recovery

### Types (src/types/)

- mcp.ts
  : TypeScript types for MCP messages and requests.
- modelcontextprotocol.d.ts
  : MCP SDK TypeScript declarations.
- module.d.ts
  : Module declarations for external libraries.

## Architectural Patterns

### Unified Server Architecture

The server architecture has been refactored to follow a unified approach where:

1. All configuration is centralized in the `config` directory
2. The Express and MCP servers are integrated in a single `Server` class
3. Routes are organized in separate modules for better maintainability

### Routing Structure

The routing system follows a modular pattern where:

1. Different route groups (API, MCP) are defined in separate files
2. Each route module exports a function that returns an Express router
3. The unified server mounts these routers at appropriate paths

### Configuration Architecture

The configuration system follows a modular pattern where:

1. Each aspect of the system has its own configuration module
2. All modules are combined in the main `config/index.ts` file
3. Environment variables are handled through utility functions

### Controller Pattern

Controllers follow the single responsibility principle:

1. `toolController` handles tool-related operations
2. `resourceController` handles resource-related operations
3. Both use the centralized configuration system
