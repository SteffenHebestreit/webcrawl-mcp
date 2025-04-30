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
+----------------------+       +------------------------+
| MCP Client (LLM UI)  | <----> | crawl4ai-server (API)  |
+----------------------+       +------------------------+
                                      |
                                      | HTTP/RPC + SSE
                                      v
                           +----------------------------+
                           | crawl4ai-service (Worker)  |
                           +----------------------------+
```

1. **craw4ai-server** (API Gateway)
   - Implements MCP discovery (`/mcp/capabilities`) and invocation (`/mcp/sse`).
   - Routes tool calls to internal controllers (ResourceController, ToolController).
   - Validates and streams results back over SSE.

2. **crawl4ai-service** (Crawl Worker)
   - Fetches web pages, extracts text/Markdown, and returns structured data.
   - Scaled independently for heavy crawling tasks.

## Key Concepts

- **Resource**: An addressable endpoint (`info://`, `crawl://`, etc.) that groups related tools or data.
- **Tool**: A callable function (e.g., `crawl`, `crawlWithMarkdown`) that performs a specific task.
- **SSE Endpoint**: `/mcp/sse` streams JSON‑encoded messages as events.

## Usage Flow

1. **Discover tools**: Query `/mcp/capabilities` to list resources and tools.
2. **Invoke a tool**: Send a POST to `/mcp/sse` with a JSON payload:
   ```json
   {
     "resource": "info://about",      
     "tool": "getInfoResource",       
     "input": {}                        
   }
   ```
3. **Process results**: Consume SSE events with partial or final outputs.

For detailed API specs, see `MCP_API.md`.