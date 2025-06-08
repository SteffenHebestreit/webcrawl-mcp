# 🏆 MCP-Server-Template - REFERENCE IMPLEMENTATION 🏆

```
███╗   ███╗ ██████╗██████╗     ██████╗ ███████╗███████╗
████╗ ████║██╔════╝██╔══██╗    ██╔══██╗██╔════╝██╔════╝
██╔████╔██║██║     ██████╔╝    ██████╔╝█████╗  █████╗  
██║╚██╔╝██║██║     ██╔═══╝     ██╔══██╗██╔══╝  ██╔══╝  
██║ ╚═╝ ██║╚██████╗██║         ██║  ██║███████╗██║     
╚═╝     ╚═╝ ╚═════╝╚═╝         ╚═╝  ╚═╝╚══════╝╚═╝     
     
   100% COMPLIANT IMPLEMENTATION ✅
```

This repository implements a **reference-grade** Model Context Protocol (MCP) server for web crawling capabilities, exposing crawlers as tools for any MCP-compliant client. It achieves **100% compliance** with the official MCP specification version 2024-11-05.

## 🎯 MCP Compliance Status: 100% COMPLIANT ✅

This server achieves **100% compliance** with the official Model Context Protocol specification:

### ✅ Core MCP Features Implemented
- **Session Management**: Complete session lifecycle with `Mcp-Session-Id` headers
- **Protocol Initialization**: Proper `initialize` and `notifications/initialized` handshake
- **Capability Negotiation**: Full support for protocol version negotiation (2024-11-05, 2025-03-26)
- **Transport Interfaces**: Callbacks for `onclose`, `onerror`, `onmessage`
- **Standard Error Codes**: All JSON-RPC 2.0 error codes (-32700, -32600, -32601, -32602, -32603)

### 🚀 Transport Protocols
- **Modern Streamable HTTP**: `/mcp` endpoint with GET info endpoint and enhanced POST handling
- **Official SSE Pattern**: Separate GET `/mcp/sse` (connection) + POST `/mcp/messages` (data)
- **Legacy SSE Support**: Backward compatible POST `/mcp/sse` endpoint

### 🛠️ Method Support
- **Modern Methods**: `tools/list`, `tools/call`, `resources/list`, `resources/read`
- **Legacy Methods**: `mcp.capabilities`, `mcp.tool.use`, `mcp.resource.list`, `mcp.resource.get`
- **Initialization**: `initialize`, `notifications/initialized`

### 🎯 Enhanced Features (June 2025)
- **Content Extraction**: Improved crawling of lottery and jackpot sites with specialized detection
- **Smart Relevance Scoring**: Adaptive thresholds for different content types
- **Markdown Generation**: Better formatting with proper headings and section detection
- **JSON Schema Support**: Created `schemaConverter.ts` utility for converting Joi schemas to JSON Schema format
- **Development-Friendly**: Relaxed rate limiting (1 min window, 1000 requests) for testing environment
- **Enhanced Debugging**: Detailed request/response logging in Streamable HTTP handler
- **HTTP Transport Improvements**: Proper JSON response termination and enhanced error handling
- **Tool Definitions**: Dedicated schemas for `crawl` and `smartCrawl` tools with improved parameter validation
- **Architecture Refactor**: Simplified tool-based architecture removing centralized service dependencies
- **Self-Contained Tools**: Each tool now includes its own browser management and crawler implementation
- **Enhanced Tool Suite**: Added specialized tools for link extraction, sitemap generation, page search, web search, and date/time utilities

### 🧪 Testing
Run MCP compliance tests: `npm run test:mcp-compliance`

Documentation
-------------
- **[OVERVIEW.md](OVERVIEW.md)**: High-level architecture and conceptual overview.
- **[CODE_STRUCTURE.md](CODE_STRUCTURE.md)**: Detailed explanation of each source file and its purpose.
- **[MCP_API.md](MCP_API.md)**: Detailed API endpoint specifications, JSON-RPC methods, request/response schemas, examples, and sequence diagrams.

Folder Structure
----------------
```
.
├── .env                        # Environment variables configuration file
├── .env-template               # Template for environment variables
├── .github/                    # GitHub-specific files (workflows, templates)
├── .gitignore                  # Git ignore configuration
├── CODE_STRUCTURE.md           # Detailed code structure documentation
├── CONTRIBUTING.md             # Contribution guidelines
├── LICENSE.md                  # MIT License file
├── MCP_API.md                  # API specifications document
├── OVERVIEW.md                 # System overview document
├── README.md                   # Project overview and quick start (this file)
├── docker-compose.yml          # Defines multi-container environment
├── package.json                # Root package with workspace configuration
│
└── mcp-service/                # MCP server implementation
    ├── Dockerfile              # Docker configuration for MCP server
    ├── package.json            # Package configuration
    ├── tsconfig.json           # TypeScript configuration
    ├── tsconfig.node.json      # TypeScript Node.js-specific configuration
    └── src/
        ├── index.ts            # Entry point for MCP server
        ├── config/             # Centralized configuration
        │   ├── index.ts        # Main configuration entry point
        │   ├── appConfig.ts    # Application settings
        │   ├── mcpConfig.ts    # MCP-specific settings
        │   ├── securityConfig.ts # Security-related settings
        │   ├── crawlConfig.ts  # Web crawling settings
        │   └── utils.ts        # Configuration utility functions
        ├── controllers/        # API endpoint controllers
        │   ├── resourceController.ts
        │   └── toolController.ts
        ├── mcp/                # MCP protocol implementation
        │   └── SimpleMcpServer.ts
        ├── routes/             # Route definitions
        │   ├── apiRoutes.ts    # General API endpoints
        │   ├── mcpRoutes.ts    # MCP-specific endpoints (SSE)
        │   └── mcpStreamableRoutes.ts # MCP endpoints with Streamable HTTP        ├── server/             # Unified server implementation
        │   └── server.ts       # Express and MCP server integration
        ├── services/           # Business logic services
        │   └── tools/          # Self-contained tool implementations
        │       ├── BaseTool.ts     # Abstract base class for all tools
        │       ├── CrawlTool.ts    # Basic web crawling tool
        │       ├── DateTimeTool.ts # Date/time utility tool
        │       ├── ExtractLinksTool.ts # Link extraction tool
        │       ├── SearchInPageTool.ts # Page content search tool
        │       ├── SitemapTool.ts  # Sitemap generation tool
        │       ├── SmartCrawlTool.ts # Intelligent markdown crawling
        │       ├── WebSearchTool.ts # Web search functionality
        │       └── index.ts    # Tool module exports
        ├── types/              # TypeScript type definitions
        │   ├── mcp.ts          # MCP type definitions
        │   ├── modelcontextprotocol.d.ts # MCP SDK type declarations
        │   └── module.d.ts     # Module declarations for external libraries
        ├── utils/              # Utility functions
        │   ├── logger.ts       # Logging utilities
        │   ├── requestLogger.ts # HTTP request logging middleware
        │   └── schemaConverter.ts # Joi to JSON Schema conversion utilities
        └── test/               # Test files
            ├── mcp-compliance-test.ts # Comprehensive MCP compliance tests
            └── mcp-compliance-test-simple.ts # Simple MCP tests
```

Quick Start
-----------

### Using Docker

```
docker-compose up --build
```

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Navigate to the mcp-service directory:
   ```bash
   cd mcp-service
   npm install
   ```
3. Define environment variables (see **Configuration**).
4. Build and start the server:
   ```bash
   npm run build
   npm start
   
   # Or for development with auto-reload:
   npm run dev
   ```

# API Endpoints

The server provides multiple endpoints:

- **MCP Streamable HTTP** (Recommended): `/mcp` - Modern JSON-RPC over HTTP with streaming support
- **MCP SSE** (Deprecated): `/mcp/sse` - Legacy Server-Sent Events endpoint
- **API Endpoints**: `/api/health`, `/api/version` - General server information

See detailed API documentation in [MCP_API.md](MCP_API.md).

# Testing Endpoints

## MCP Streamable HTTP Endpoint (Recommended)

The modern approach recommended by the MCP specification.

### Capabilities Request
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.capabilities",
      "params": {},
      "id": 1
    }'
```

### Use Tool (crawl)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "crawl",
        "parameters": { 
          "url": "https://example.com", 
          "maxPages": 3,
          "depth": 1,
          "strategy": "bfs",
          "captureScreenshots": true,
          "captureNetworkTraffic": false,
          "waitTime": 2000
        }
      },
      "id": 2
    }'
```

### Use Tool (smartCrawl)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "smartCrawl",
        "parameters": { 
          "url": "https://example.com", 
          "query": "What is this site about?",
          "maxPages": 2,
          "depth": 1,
          "waitTime": 1500
        }
      },
      "id": 3
    }'
```

### Use Tool (extractLinks)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "extractLinks",
        "parameters": { 
          "url": "https://example.com"
        }
      },
      "id": 4
    }'
```

### Use Tool (sitemapGenerator)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "sitemapGenerator",
        "parameters": { 
          "url": "https://example.com",
          "maxPages": 10,
          "depth": 2
        }
      },
      "id": 5
    }'
```

### Use Tool (searchInPage)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "searchInPage",
        "parameters": { 
          "url": "https://example.com",
          "searchTerm": "contact information"
        }
      },
      "id": 6
    }'
```

### Use Tool (webSearch)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "webSearch",
        "parameters": { 
          "query": "MCP protocol specification",
          "maxResults": 5
        }
      },
      "id": 7
    }'
```

### Use Tool (dateTime)
```bash
curl -X POST http://localhost:${PORT:-3000}/mcp \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "dateTime",
        "parameters": {}
      },
      "id": 8
    }'
```

## MCP SSE Endpoint (Deprecated)

The legacy approach that uses Server-Sent Events (SSE).

### Capabilities Request
```bash
curl -N -X POST http://localhost:${PORT:-3000}/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.capabilities",
      "params": {},
      "id": 1
    }'
```

### Use Tool (crawl)
```bash
curl -N -X POST http://localhost:${PORT:-3000}/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "crawl",
        "parameters": { "url": "https://example.com", "maxPages": 1 }
      },
      "id": 2
    }'
```

### Use Tool (smartCrawl)
```bash
curl -N -X POST http://localhost:${PORT:-3000}/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{
      "jsonrpc": "2.0",
      "method": "mcp.tool.use",
      "params": {
        "name": "smartCrawl",
        "parameters": { 
          "url": "https://example.com", 
          "query": "What is this site about?",
          "maxPages": 1 
        }
      },
      "id": 3
    }'
```

## API Endpoints

### Health Check
```bash
curl http://localhost:${PORT:-3000}/api/health
```

Response:
```
OK
```

### Version Info
```bash
curl http://localhost:${PORT:-3000}/api/version
```

Response:
```json
{"name":"webcrawl-mcp","version":"1.0.0","description":"MCP Server for scrape websites"}
```

### List Available Tools
```bash
curl http://localhost:${PORT:-3000}/api/tools
```

Response:
```json
{
  "success": true,
  "tools": [
    {
      "name": "crawl",
      "description": "Crawl a website and extract text content and tables.",
      "parameterDescription": "URL to crawl along with optional crawling parameters like maxPages, depth, strategy, etc.",
      "returnDescription": "Object containing success status, original URL, extracted text content, optional tables, and optional error message.",
      "endpoint": "/api/tools/crawl"
    },
    {
      "name": "smartCrawl", 
      "description": "Crawl a website and return markdown-formatted content, potentially answering a specific query.",
      "parameterDescription": "URL to crawl, optional crawling parameters, and an optional query.",
      "returnDescription": "Object containing success status, original URL, markdown content, and optional error message.",
      "endpoint": "/api/tools/smartCrawl"
    },
    {
      "name": "extractLinks",
      "description": "Extract and categorize links from a web page.",
      "parameterDescription": "URL to extract links from.",
      "returnDescription": "Object containing internal and external links with their descriptions.",
      "endpoint": "/api/tools/extractLinks"
    },
    {
      "name": "sitemapGenerator",
      "description": "Generate a sitemap from a website by crawling its pages.",
      "parameterDescription": "URL to crawl for sitemap generation with optional depth and maxPages.",
      "returnDescription": "Object containing the generated sitemap structure.",
      "endpoint": "/api/tools/sitemapGenerator"
    },
    {
      "name": "searchInPage",
      "description": "Search for specific content within a web page.",
      "parameterDescription": "URL and search term to look for.",
      "returnDescription": "Object containing search results and matches.",
      "endpoint": "/api/tools/searchInPage"
    },
    {
      "name": "webSearch",
      "description": "Perform web search and extract results.",
      "parameterDescription": "Search query and maximum number of results.",
      "returnDescription": "Object containing search results with titles, descriptions, and URLs.",
      "endpoint": "/api/tools/webSearch"
    },
    {
      "name": "dateTime",
      "description": "Get current date and time information in various formats.",
      "parameterDescription": "Optional timezone parameter.",
      "returnDescription": "Object containing current date/time in multiple formats.",
      "endpoint": "/api/tools/dateTime"
    }
  ]
}
```

### Direct Tool Execution

#### Crawl Tool
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "maxPages": 3,
    "depth": 1,
    "strategy": "bfs",
    "captureScreenshots": true,
    "captureNetworkTraffic": false,
    "waitTime": 2000
  }'
```

#### Smart Crawl Tool (Markdown Output)
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/smartCrawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "query": "What is this site about?",
    "maxPages": 2,
    "depth": 1
  }'
```

#### Extract Links Tool
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/extractLinks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com"
  }'
```

#### Sitemap Generator Tool
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/sitemapGenerator \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "maxPages": 10,
    "depth": 2
  }'
```

#### Search In Page Tool
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/searchInPage \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "searchTerm": "contact information"
  }'
```

#### Web Search Tool
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/webSearch \
  -H "Content-Type: application/json" \
  -d '{
    "query": "MCP protocol specification",
    "maxResults": 5
  }'
```

#### Date Time Tool
```bash
curl -X POST http://localhost:${PORT:-3000}/api/tools/dateTime \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "UTC"
  }'
```

Environment Variables
---------------------
- `PORT` (default: 3000): Port for the MCP server.
- `NODE_ENV` (default: development): Environment mode (development or production).
- `MCP_NAME`, `MCP_VERSION`, `MCP_DESCRIPTION`: MCP server identification.
- `CRAWL_DEFAULT_MAX_PAGES` (default: 10): Default maximum pages to crawl.
- `CRAWL_DEFAULT_DEPTH` (default: 3): Default crawl depth.
- `CRAWL_DEFAULT_STRATEGY` (default: bfs): Default crawl strategy (bfs|dfs|bestFirst).
- `CRAWL_DEFAULT_WAIT_TIME` (default: 1000): Default wait time in ms between requests.
- `LOG_LEVEL` (default: info): Logging level (debug|info|warn|error).
- `CACHE_TTL` (default: 3600): Cache TTL in seconds.
- `MAX_REQUEST_SIZE` (default: 10mb): Maximum HTTP payload size.
- `CORS_ORIGINS` (default: *): Allowed origins for CORS.
- `RATE_LIMIT_WINDOW` (default: 900000): Rate limit window in milliseconds (15 minutes).
- `RATE_LIMIT_MAX_REQUESTS` (default: 100): Max requests per rate limit window.
- `PUPPETEER_EXECUTABLE_PATH` (optional): Custom path to Chrome/Chromium executable for Puppeteer.
- `PUPPETEER_SKIP_DOWNLOAD` (default: false): Skip automatic Chromium download during installation.

Configuration
-------------
All configuration is centralized in the `src/config` directory with separate modules for different aspects of the system:
- `appConfig.ts`: Core application settings
- `mcpConfig.ts`: MCP server specific settings
- `securityConfig.ts`: Security-related settings
- `crawlConfig.ts`: Web crawling default parameters

Key Components
--------------
- **Server**: Unified server implementation integrating Express and MCP capabilities.
- **Routes**: Organized in separate files for API and MCP endpoints.
- **SimpleMcpServer**: Implements MCP discovery and tool invocation logic.
- **Controllers**: `toolController` and `resourceController` for handling business logic.
- **Tools**: Self-contained tool implementations extending the BaseTool abstract class:
  - **CrawlTool**: Basic web crawling with content extraction
  - **SmartCrawlTool**: Intelligent crawling with markdown output and query support
  - **ExtractLinksTool**: Extract and categorize links from web pages
  - **SitemapTool**: Generate sitemaps from crawled content
  - **SearchInPageTool**: Search for specific content within web pages
  - **WebSearchTool**: Web search functionality with result extraction
  - **DateTimeTool**: Date and time utility functions
- **Configuration**: Centralized configuration system with module-specific settings.
- **MCP Transport**: Supports both modern Streamable HTTP and legacy SSE transport methods.
- **Tool Architecture**: Each tool includes its own browser management, crawling logic, and error handling for complete self-containment.

## Web Crawling Features

The MCP server includes a comprehensive set of self-contained crawling tools, each with integrated browser management and specialized functionality:

### Tool-Based Architecture
- **Self-Contained Design**: Each tool manages its own Puppeteer browser instance and crawling logic
- **BaseTool Abstract Class**: Common functionality shared across all tools with standardized error handling
- **Independent Operation**: Tools operate without shared service dependencies for improved reliability

### Available Tools

#### CrawlTool
- **Basic Web Crawling**: Extract text content and tables from web pages
- **Multiple Strategies**: BFS, DFS, and best-first crawling approaches
- **Screenshot Capture**: Optional full-page screenshot functionality
- **Content Extraction**: Intelligent visible text extraction skipping hidden elements

#### SmartCrawlTool  
- **Markdown Output**: HTML to Markdown conversion with custom formatting rules
- **Query-Based Crawling**: Focused content extraction based on specific queries
- **Smart Content Detection**: Enhanced relevance scoring for different content types
- **Structured Output**: Well-formatted markdown with proper headings and sections

#### ExtractLinksTool
- **Link Categorization**: Separate internal and external link extraction
- **Link Analysis**: Extract link text, URLs, and descriptions
- **Comprehensive Coverage**: Find all clickable links within page content

#### SitemapTool
- **Sitemap Generation**: Create structured sitemaps from crawled content
- **Hierarchical Structure**: Organize pages by depth and relationship
- **Configurable Depth**: Control crawling depth for sitemap generation

#### SearchInPageTool
- **Content Search**: Find specific terms or phrases within web pages
- **Context Extraction**: Provide surrounding context for search matches
- **Relevance Scoring**: Rank search results by relevance

#### WebSearchTool
- **Web Search Integration**: Perform web searches and extract results
- **Result Processing**: Extract titles, descriptions, and URLs from search results
- **Configurable Results**: Control number of results returned

#### DateTimeTool
- **Time Utilities**: Current date/time in multiple formats
- **Timezone Support**: Convert times across different timezones
- **Formatting Options**: Various date/time format outputs

### Shared Browser Management Features
- **Robust Error Handling**: Improved browser initialization with proper error handling and fallback mechanisms
- **Custom Chrome Path**: Support for custom Chrome/Chromium executable paths via `PUPPETEER_EXECUTABLE_PATH`
- **Resource Management**: Automatic browser cleanup and connection management in each tool
- **Independent Instances**: Each tool manages its own browser instance for better isolation

### Content Extraction (Across Tools)
- **Text Extraction**: Intelligent visible text extraction that skips hidden elements and scripts
- **Markdown Conversion**: HTML to Markdown conversion with custom rules for tables and code blocks
- **Table Extraction**: Structured extraction of HTML tables with caption support
- **Screenshot Capture**: Optional full-page screenshot functionality
- **Link Processing**: Extract and categorize internal vs external links

### Crawling Strategies
- **Breadth-First Search (BFS)**: Default strategy for systematic exploration
- **Depth-First Search (DFS)**: Prioritizes deeper paths in the site structure
- **Best-First Search**: Simple heuristic-based crawling (shorter paths first)

### Advanced Options
- **Network Traffic Monitoring**: Optional tracking of HTTP requests during crawling
- **Multi-page Crawling**: Support for crawling multiple pages with depth control
- **Wait Time Configuration**: Configurable delays between page loads
- **Screenshot Capture**: Optional full-page screenshots saved to temporary directory

### Error Resilience
- **Browser Launch Fallbacks**: Multiple strategies for browser initialization
- **Connection Recovery**: Automatic reconnection handling for disconnected browsers
- **URL Validation**: Robust URL parsing and validation with error handling
- **Timeout Management**: Configurable timeouts to prevent hanging on slow pages

Customization
-------------
- Add new routes in the `routes` directory.
- Extend MCP capabilities by modifying `SimpleMcpServer` or adding new controllers.
- Create new tools by extending the `BaseTool` abstract class in the `services/tools` directory.
- Each tool is self-contained and can be developed independently.
- Tune performance and security via environment variables in the `config` directory.

## Architecture Diagram
```mermaid
graph LR
  Client --> Server
  Server --> Router["Routes (API/MCP)"]
  Router --> |SSE| SimpleMcpServer
  Router --> |Streamable HTTP| SimpleMcpServer
  Router --> ApiControllers
  SimpleMcpServer --> Controllers
  Controllers --> Tools["Self-Contained Tools"]
  Tools --> |BaseTool| CrawlTool
  Tools --> |BaseTool| SmartCrawlTool
  Tools --> |BaseTool| ExtractLinksTool
  Tools --> |BaseTool| SitemapTool
  Tools --> |BaseTool| SearchInPageTool
  Tools --> |BaseTool| WebSearchTool
  Tools --> |BaseTool| DateTimeTool
```

## References

- [Overview](OVERVIEW.md): High-level architecture and conceptual overview.
- [Code Structure](CODE_STRUCTURE.md): Detailed explanations of source files.
- [MCP API Reference](MCP_API.md): Endpoint specs and JSON-RPC methods.
- [Model Context Protocol SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk): Official SDK documentation.
- [MCP Transport Models](https://github.com/modelcontextprotocol/typescript-sdk#transport): Details on SSE vs Streamable HTTP.

## License

This project is licensed under the MIT License (see the `license` field in `package.json`).
