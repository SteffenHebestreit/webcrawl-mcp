# Contributing to MCP-Server-Template

Thank you for your interest in contributing to MCP-Server-Template! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project.

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in the Issues section
- Use the bug report template when creating a new issue
- Include detailed steps to reproduce the bug
- Include information about your environment (OS, Node.js version, etc.)

### Suggesting Features

- Check if the feature has already been suggested in the Issues section
- Use the feature request template when creating a new issue
- Explain why this feature would be useful to most users

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the tests to ensure nothing is broken
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request using the PR template

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- Docker and Docker Compose (for containerized development)

### Local Development

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/crawl4ai-server.git
   cd crawl4ai-server
   ```

2. Install dependencies
   ```bash
   npm install
   ```
   
3. Create a `.env` file based on `.env-template`

4. Start the development server
   ```bash
   npm run dev
   ```

### Using Docker

```bash
docker-compose up --build
```

## Coding Guidelines

- Follow the existing code style
- Write clear, commented, and testable code
- Keep pull requests focused on a single topic

## License

By contributing to MCP-Server-Template, you agree that your contributions will be licensed under the project's MIT License.