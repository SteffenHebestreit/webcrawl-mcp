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

#### Tools (src/services/tools/)
The service layer has been refactored into a tool-based architecture where each tool is self-contained with its own browser management and crawling logic:

- **BaseTool.ts**
  : Abstract base class providing common functionality for all tools including browser management, error handling, and logging.

- **CrawlTool.ts**
  : Basic web crawling tool with content extraction capabilities. Features include:
    - Text extraction and table processing
    - Multiple crawling strategies (BFS, DFS, best-first)
    - Screenshot capture and network monitoring
    - Self-contained browser management

- **SmartCrawlTool.ts**
  : Intelligent crawling tool with markdown output and query support. Features include:
    - HTML-to-Markdown conversion with custom formatting
    - Query-based content filtering and relevance scoring
    - Enhanced content detection for specialized sites
    - Structured markdown output with proper headings

- **ExtractLinksTool.ts**
  : Specialized tool for link extraction and categorization. Features include:
    - Internal vs external link classification
    - Link text and description extraction
    - Comprehensive link discovery within page content

- **SitemapTool.ts**
  : Sitemap generation tool for creating structured site maps. Features include:
    - Hierarchical sitemap structure
    - Configurable crawling depth
    - URL relationship mapping

- **SearchInPageTool.ts**
  : Content search tool for finding specific terms within web pages. Features include:
    - Text search with context extraction
    - Relevance scoring for search results
    - Match highlighting and positioning

- **WebSearchTool.ts**
  : Web search integration tool for performing searches and extracting results. Features include:
    - Search result extraction (titles, descriptions, URLs)
    - Configurable result limits
    - Result processing and formatting

- **DateTimeTool.ts**
  : Utility tool for date and time operations. Features include:
    - Current date/time in multiple formats
    - Timezone conversion support
    - Flexible formatting options

- **index.ts**
  : Module exports for all tool implementations.

### Types (src/types/)

### Types (src/types/)

- **mcp.ts**
  : TypeScript types for MCP messages and requests. Enhanced with support for:
    - External link classification in ExtractLinksResponse
    - Comprehensive tool parameter and response interfaces
    - Enhanced error handling types

- **crawler.ts**
  : TypeScript types for crawler-related interfaces and configurations.

- **modelcontextprotocol.d.ts**
  : MCP SDK TypeScript declarations.

- **module.d.ts**
  : Module declarations for external libraries.

## Architectural Patterns

### Tool-Based Architecture

The service layer has been refactored to follow a tool-based architecture pattern where:

1. **Self-Contained Tools**: Each tool extends the `BaseTool` abstract class and includes its own browser management and crawling logic
2. **Independent Operation**: Tools operate without shared service dependencies for improved reliability and scalability  
3. **Common Interface**: All tools implement a standardized `execute()` method through the base class
4. **Isolated Browser Management**: Each tool manages its own Puppeteer browser instance to prevent conflicts
5. **Specialized Functionality**: Tools are focused on specific use cases (crawling, link extraction, search, etc.)

### Unified Server Architecture

The server architecture has been refactored to follow a unified approach where:

1. All configuration is centralized in the `config` directory
2. The Express and MCP servers are integrated in a single `Server` class
3. Routes are organized in separate modules for better maintainability
4. Controllers orchestrate tool execution without service layer dependencies

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
