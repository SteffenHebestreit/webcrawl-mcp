import express from 'express';
import { Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const app = express();
app.use(express.json());
app.use(cors());

// Create a temporary directory to store crawl scripts and results
const TMP_DIR = path.join(os.tmpdir(), 'crawl4ai-service');

// Ensure the temporary directory exists
async function ensureTmpDir() {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating temporary directory:', error);
  }
}

// Function to generate a unique filename
function generateUniqueFilename(prefix: string = 'crawl', extension: string = '.py') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}${extension}`;
}

// Function to create a Python script that uses crawl4ai
async function createCrawlScript(url: string, options: any) {
  const scriptPath = path.join(TMP_DIR, generateUniqueFilename());
  const resultPath = scriptPath.replace('.py', '.json');
  
  // Create the Python script content
  const scriptContent = `
import json
import sys
import traceback
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

async def run_crawler():
    try:
        crawler = AsyncWebCrawler()
        await crawler.start()
        
        config = CrawlerRunConfig(
            capture_network=${options.captureNetworkTraffic || 'False'},
            capture_console=${options.captureConsole || 'False'},
            mhtml=${options.captureHTML || 'False'},
            screenshots=${options.captureScreenshots || 'False'},
            waitTime=${options.waitTime || 2000}
        )
        
        result = await crawler.arun({
            "url": "${url}",
            "maxPages": ${options.maxPages || 1},
            "depth": ${options.depth || 0},
            "strategy": "${options.strategy || 'bfs'}",
            "query": "${options.query || ''}",
            "config": config
        })
        
        # Prepare the result as JSON
        output = {
            "success": True,
            "url": "${url}",
            "markdown": result.get("markdown", "No markdown content was generated."),
            "media": result.get("media", {"tables": []}),
            "text": result.get("text", "No text content was extracted.")
        }
        
        await crawler.stop()
        
        # Save result to file
        with open("${resultPath}", "w", encoding="utf-8") as f:
            json.dump(output, f)
            
        print("Crawling completed successfully")
        
    except Exception as e:
        error_message = str(e)
        traceback_str = traceback.format_exc()
        
        # Save error to result file
        with open("${resultPath}", "w", encoding="utf-8") as f:
            json.dump({
                "success": False,
                "url": "${url}",
                "error": error_message,
                "traceback": traceback_str,
                "markdown": f"# Error\\n\\nError occurred while crawling ${url}: {error_message}",
                "text": f"Error occurred while crawling ${url}: {error_message}"
            }, f)
        
        print(f"Error during crawling: {error_message}")
        print(traceback_str)

# Run the crawler using asyncio
if __name__ == "__main__":
    import asyncio
    asyncio.run(run_crawler())
  `;
  
  // Write the script to the file
  await fs.writeFile(scriptPath, scriptContent, 'utf-8');
  
  return { scriptPath, resultPath };
}

// Function to run a Python script and wait for it to complete
async function runPythonScript(scriptPath: string, resultPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Spawn Python process
    const pythonProcess = spawn('python', [scriptPath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`Python stdout: ${data}`);
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', async (code) => {
      console.log(`Python process exited with code ${code}`);
      
      try {
        // Try to read the result file
        const resultContent = await fs.readFile(resultPath, 'utf-8');
        const result = JSON.parse(resultContent);
        resolve(result);
      } catch (error) {
        reject({
          success: false,
          error: `Failed to read result file: ${error}. Python process exited with code ${code}`,
          stdout: stdoutData,
          stderr: stderrData
        });
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject({
        success: false,
        error: `Failed to start Python process: ${error}`,
      });
    });
  });
}

// Real implementation using Crawl4AI via Python subprocess
async function crawlWebsite(url: string, options: any = {}) {
  console.log(`🕷️ Crawling website: ${url} with options:`, options);
  
  try {
    // Ensure temporary directory exists
    await ensureTmpDir();
    
    // Create Python script for crawling
    const { scriptPath, resultPath } = await createCrawlScript(url, options);
    
    // Run the Python script
    const result = await runPythonScript(scriptPath, resultPath);
    
    // Clean up temporary files
    try {
      await fs.unlink(scriptPath);
      await fs.unlink(resultPath);
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
    }
    
    return result;
  } catch (error: any) {
    console.error('Error during crawling:', error);
    throw error;
  }
}

// Define the crawling endpoint
app.post('/api/crawl', async (req: Request, res: Response) => {
  try {
    const { url, maxPages, depth, strategy, captureNetworkTraffic, captureScreenshots, 
            waitTime, query, markdownFormat, captureConsole, captureHTML } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }
    
    console.log(`🌐 Received crawl request for ${url}`);
    
    // Create options object for Crawl4AI
    const options = {
      maxPages,
      depth,
      strategy,
      query,
      captureNetworkTraffic,
      captureScreenshots,
      captureConsole,
      captureHTML,
      waitTime
    };
    
    // Call the crawl function
    const result = await crawlWebsite(url, options);
    
    console.log(`✅ Successfully crawled ${url}`);
    
    // Return the result
    res.json(result);
  } catch (error: any) {
    console.error('❌ Error during crawling:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An unknown error occurred during crawling'
    });
  }
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Create a simple Python script to test if Python and crawl4ai are working
    const testScript = `
import sys
try:
    import crawl4ai
    print("Crawl4AI is installed and working")
    sys.exit(0)
except ImportError as e:
    print(f"Error importing crawl4ai: {e}")
    sys.exit(1)
    `;
    
    const testScriptPath = path.join(TMP_DIR, 'health-check.py');
    await fs.writeFile(testScriptPath, testScript, 'utf-8');
    
    const testProcess = spawn('python', [testScriptPath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    testProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    testProcess.on('close', async (code) => {
      try {
        await fs.unlink(testScriptPath);
      } catch (error) {
        console.error('Error cleaning up health check script:', error);
      }
      
      if (code === 0) {
        res.status(200).send('OK');
      } else {
        res.status(503).send(`Service Unavailable: Crawl4AI not working properly\nStdout: ${stdoutData}\nStderr: ${stderrData}`);
      }
    });
    
    testProcess.on('error', (error) => {
      res.status(503).send(`Service Unavailable: ${error.message}`);
    });
  } catch (error: any) {
    res.status(503).send(`Service Unavailable: ${error.message}`);
  }
});

// Create temporary directory on startup
ensureTmpDir().catch(console.error);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Crawl4AI service running on port ${PORT}`);
});