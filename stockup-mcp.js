#!/usr/bin/env node

/**
 * StockUp Quan - Model Context Protocol (MCP) Server
 * Exposes StockUp Quan's grounded financial intelligence model to Claude Desktop, Cursor, and other MCP clients.
 *
 * Requirements:
 * - Node.js installed locally.
 * - environment variable STOCKUP_API_KEY configured in your client.
 */

const http = require('http');
const https = require('https');
const url = require('url');

// Write log messages to stderr so they do not interfere with stdio JSON-RPC
function log(msg) {
    console.error(`[StockUp MCP] ${msg}`);
}

// Check for API key configuration
const API_KEY = process.env.STOCKUP_API_KEY;
if (!API_KEY) {
    log("Warning: STOCKUP_API_KEY environment variable is not set. API calls will fail.");
}

// Buffer standard input streams
let buffer = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, index).trim();
        buffer = buffer.substring(index + 1);
        if (line) {
            handleMessage(line);
        }
    }
});

function sendResponse(id, result, error = null) {
    const payload = {
        jsonrpc: "2.0",
        id
    };
    if (error) {
        payload.error = error;
    } else {
        payload.result = result;
    }
    process.stdout.write(JSON.stringify(payload) + "\n");
}

function handleMessage(line) {
    let req;
    try {
        req = JSON.parse(line);
    } catch (err) {
        log(`Failed to parse incoming line: ${line}`);
        return;
    }

    const { id, method, params } = req;

    if (method === "initialize") {
        sendResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: "stockup-mcp",
                version: "1.0.0"
            }
        });
    } else if (method === "initialized") {
        // Notification: client has successfully connected
        log("Connection initialized.");
    } else if (method === "tools/list") {
        sendResponse(id, {
            tools: [
                {
                    name: "financial_reasoning_query",
                    description: "Send natural language financial prompts (e.g. stock valuations, sentiment audits, competitor comparisons, SEC filings analyses) to StockUp Quan AI, grounded with real-time stock quotes from Yahoo Finance.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "The detailed financial query, question, or research task to run (e.g. 'Compare Apple and Tesla PE ratios' or 'Analyze current sentiment for TSLA')."
                            },
                            model: {
                                type: "string",
                                enum: ["quan-3.0", "quan-3.3", "quan-3.3-deep-research"],
                                default: "quan-3.3",
                                description: "Model variant to use. Use quan-3.0 for speed, quan-3.3 for flagship reasoning, and quan-3.3-deep-research for advanced deep portfolio/SEC filings audits."
                            },
                            googleSearch: {
                                type: "boolean",
                                default: true,
                                description: "Whether to enable live Google Search grounding."
                            },
                            temperature: {
                                type: "number",
                                default: 0.2,
                                description: "Creativity parameter (0.0 to 2.0)."
                            }
                        },
                        required: ["prompt"]
                    }
                }
            ]
        });
    } else if (method === "tools/call") {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (toolName === "financial_reasoning_query") {
            callStockUpApi(id, toolArgs);
        } else {
            sendResponse(id, null, {
                code: -32601,
                message: `Method not found: tool '${toolName}'`
            });
        }
    } else if (method === "ping") {
        sendResponse(id, {});
    } else {
        // Unknown method
        if (id !== undefined) {
            sendResponse(id, null, {
                code: -32601,
                message: `Method not found: '${method}'`
            });
        }
    }
}

function callStockUpApi(reqId, args) {
    if (!API_KEY) {
        sendResponse(reqId, null, {
            code: -32603,
            message: "Missing STOCKUP_API_KEY environment variable. Set it in the Claude Desktop configuration settings."
        });
        return;
    }

    const payload = JSON.stringify({
        model: args.model || "quan-3.3",
        messages: [
            { role: "user", content: args.prompt }
        ],
        stream: false,
        googleSearch: args.googleSearch !== undefined ? args.googleSearch : true,
        temperature: args.temperature !== undefined ? args.temperature : 0.2
    });

    // Check development mode
    const isLocalDev = process.env.STOCKUP_LOCAL_DEV === "true";
    const endpointUrl = isLocalDev 
        ? "http://127.0.0.1:5001/stockup-4ab83/us-central1/quanPublicApi"
        : "https://stockup-4ab83.web.app/quanPublicApi";

    const parsedUrl = url.parse(endpointUrl);
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.path,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "Content-Length": Buffer.byteLength(payload)
        }
    };

    const clientModule = parsedUrl.protocol === "https:" ? https : http;

    log(`Calling StockUp API at ${endpointUrl}...`);

    const req = clientModule.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
            if (res.statusCode === 200) {
                try {
                    const responseJson = JSON.parse(body);
                    const responseText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    sendResponse(reqId, {
                        content: [
                            {
                                type: "text",
                                text: responseText
                            }
                        ]
                    });
                } catch (err) {
                    sendResponse(reqId, null, {
                        code: -32603,
                        message: `Failed to parse API response: ${err.message}`
                    });
                }
            } else if (res.statusCode === 402) {
                sendResponse(reqId, null, {
                    code: 402,
                    message: "Payment Required - Insufficient prepaid wallet balance. Top up your balance at https://stockup.cc/api"
                });
            } else {
                sendResponse(reqId, null, {
                    code: -32603,
                    message: `API returned error status ${res.statusCode}: ${body}`
                });
            }
        });
    });

    req.on("error", (err) => {
        sendResponse(reqId, null, {
            code: -32603,
            message: `Network request error: ${err.message}`
        });
    });

    req.write(payload);
    req.end();
}
