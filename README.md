# StockUp Quan Financial AI — Model Context Protocol (MCP) Server

Connect Claude Desktop, Cursor, and other AI agents directly to **StockUp Quan**, the premier financial intelligence reasoning model grounded with real-time, zero-hallucination stock quote data.

---

## Features
- **Real-Time Stock Grounding:** Automatically extracts stock prices, session margins, and trading volumes from Yahoo Finance and prepends them as context to your queries.
- **Deep Reasoning Models:** Exposes the specialized `quan-3.0`, `quan-3.3` (Standard), and `quan-3.3-deep-research` models for portfolio setups, competitor comparisons, and SEC filing audits.
- **AI-Ready Tools:** Exposes a native `financial_reasoning_query` tool that handles all complex financial reasoning prompts.

---

## Installation & Setup

### Prerequisite
Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

### Step 1: Obtain a StockUp API Key
1. Sign up or log in to the StockUp Developer Console at [https://stockup.cc/api](https://stockup.cc/api).
2. Refill your prepaid wallet and click **New Key** under **API Credentials** to generate a secret key (starting with `sk_quan_`).

### Step 2: Configure Claude Desktop
Add this server configuration to your Claude Desktop configuration file:
* **MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "stockup": {
      "command": "node",
      "args": ["/path/to/stockup-mcp.js"],
      "env": {
        "STOCKUP_API_KEY": "YOUR_SECRET_API_KEY"
      }
    }
  }
}
```
*(Make sure to replace `/path/to/stockup-mcp.js` with the absolute local path to your script, and `YOUR_SECRET_API_KEY` with your actual StockUp API key).*

### Step 3: Restart Claude Desktop
Fully close and restart Claude Desktop. You will see a small **Hammer icon** 🛠️ in the chat box, indicating that the StockUp tools are active!

---

## Exponent Tools

### 1. `financial_reasoning_query`
Queries the StockUp Quan model with live quote grounding.

- **Parameters:**
  - `prompt` (string, required): The financial analysis or stock query.
  - `model` (string, optional): One of `quan-3.0` (speed), `quan-3.3` (flagship reasoning), or `quan-3.3-deep-research` (portfolio scour).
  - `googleSearch` (boolean, optional): Enables live Google Search grounding. Default: `true`.
  - `temperature` (number, optional): Query sampling variance.

---

## Example Queries to Try:
- *"Analyze Apple's current valuation compared to Microsoft and Google P/E multiples."*
- *"Audit Tesla's current setups and recommend a DCA strategy based on their technical averages."*
- *"Perform a competitive qualitative tradeoff between NVDA and AMD."*
