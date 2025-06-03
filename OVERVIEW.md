# Overview of MCP-Server-Template

This document provides a simplified guide to the Model Context Protocol (MCP) and explains the high‑level architecture of the MCP-Server-Template.

## Additional Documentation

- **[README.md](README.md)**: Technical documentation with setup instructions and configuration details.
- **[CODE_STRUCTURE.md](CODE_STRUCTURE.md)**: Detailed explanation of each source file and its purpose.
- **[MCP_API.md](MCP_API.md)**: Detailed API endpoint specifications, JSON-RPC methods, request/response schemas, examples, and sequence diagrams.

## What is MCP?
MCP (Model Context Protocol) is a lightweight, HTTP‑based protocol for discovering and invoking tools exposed by an AI model or service. It standardizes:

- **Discovery**: List available resources and tools.
- **Invocation**: Send tasks or inputs to a specific tool.
- **Streaming**: Receive incremental results via Server‑Sent Events (SSE).

MCP makes it easy to integrate external services (e.g., web crawlers) into LLM workflows.

## Architecture

```
+----------------------+       +----------------------------+
| MCP Client (LLM UI)  | <----> | Unified Server            |
+----------------------+       | (Express + MCP)            |
                               +----------------------------+
                               |            |               |
                               v            v               v
                         +----------+  +----------+  +------------+
                         | API      |  | MCP      |  | Crawl      |
                         | Routes   |  | Routes   |  | Execution  |
                         +----------+  +----------+  +------------+
```

1. **Unified Server**
   - Integrates Express and MCP server functionality in a single server class
   - Provides centralized configuration through the `config` directory
   - Organizes routes through modular route definitions

2. **Routes**
   - **API Routes**: Handle general API endpoints like health checks and version info
   - **MCP Routes**: Implement MCP discovery (`/mcp/capabilities`) and invocation (`/mcp/sse`)

3. **Crawl Execution**
   - Advanced web crawling service with Puppeteer integration
   - Multiple crawling strategies (BFS, DFS, Best-First)
   - Intelligent content extraction (text, markdown, tables)
   - Screenshot capture and network traffic monitoring capabilities
   - Error resilience with timeout management and connection recovery

## Key Components

- **Centralized Configuration**: All configuration is logically organized in the `config` directory with separate modules for app, MCP, security, and crawling settings
- **Unified Server**: Combines Express and MCP functionality in a single server class with integrated routing
- **Modular Routes**: Route definitions are separated by domain (API, MCP) with support for both modern Streamable HTTP and legacy SSE endpoints
- **Controllers**: Handle business logic for resources and tools with comprehensive error handling and validation
- **MCP Protocol**: Implemented in the `SimpleMcpServer` class with support for both transport methods
- **Advanced Web Crawler**: Puppeteer-based crawler with multiple strategies, content extraction, and screenshot capabilities

## Key Concepts

- **Resource**: An addressable endpoint (`info://`, `crawl://`, etc.) that groups related tools or data.
- **Tool**: A callable function that performs a specific task:
  - `crawl`: Basic web crawling with text extraction and table parsing
  - `crawlWithMarkdown`: Advanced crawling with HTML-to-Markdown conversion and query support
- **SSE Endpoint**: `/mcp/sse` streams JSON‑encoded messages as events (legacy)
- **Streamable HTTP**: `/mcp` modern JSON-RPC over HTTP with chunked transfer encoding (recommended)
- **Crawling Strategies**: Different approaches to multi-page crawling (BFS, DFS, Best-First)
- **Content Extraction**: Intelligent extraction of visible text, tables, and optional screenshots

## Usage Flow

1. **Discover tools**: Query `/mcp/capabilities` to list resources and tools.
2. **Invoke a tool**: Send a POST to `/mcp` (recommended) or `/mcp/sse` (legacy) with a JSON payload:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "mcp.tool.use",
     "params": {
       "name": "crawl",
       "parameters": { 
         "url": "https://example.com",
         "maxPages": 3,
         "depth": 1,
         "strategy": "bfs",
         "captureScreenshots": true
       }
     },
     "id": 1
   }
   ```
3. **Process results**: Consume response with structured data including text, markdown, tables, or error information.

## API Endpoints

- **`/mcp`**: Modern MCP endpoint using Streamable HTTP (recommended)
- **`/mcp/sse`**: Legacy MCP endpoint for Server-Sent Events communication
- **`/api/health`**: Health check endpoint
- **`/api/version`**: Version information endpoint

For detailed API specs, see `MCP_API.md`.