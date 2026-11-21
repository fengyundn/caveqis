# CAVEQIS MCP

CAVEQIS 1.2.0 exposes its local math engine to MCP clients. Calculations run on the device. If the client uses a hosted AI model, the client may send inputs and results to that model.

## Windows and Linux

Add a **stdio** server in your MCP client. Use the full path to the installed engine as the command and pass `--mcp` as its only argument. The client starts the engine.

| Platform | Engine path |
| --- | --- |
| Windows | `<CAVEQIS installation folder>\resources\engine\caveqis-engine.exe` |
| Linux | `/opt/CAVEQIS/resources/engine/caveqis-engine` |

An example for clients that accept JSON configuration:

```json
{
  "mcpServers": {
    "caveqis": {
      "command": "/opt/CAVEQIS/resources/engine/caveqis-engine",
      "args": ["--mcp"]
    }
  }
}
```

Use a doubled backslash in a Windows JSON path. From a source checkout, the equivalent is `python caveqis_mcp.py` after installing the Python dependencies.

## Android

1. Open **Settings** in CAVEQIS and turn on **Enable local MCP**.
2. Select **Copy MCP configuration**. Set your AI client's transport to **Streamable HTTP**, and paste the URL and the `Authorization` header from the configuration.
3. Connect from a native client on the same device. Keep CAVEQIS active and visible. Leaving the foreground disables the listener, and the next session uses a new URL and token.

The server listens on `127.0.0.1` with a randomly assigned port. Treat the bearer token as a credential. A client that only accepts cloud-hosted MCP endpoints cannot reach this address.

## Tools

| Tool | Example arguments | Result |
| --- | --- | --- |
| `calculate` | `{"expression":"1/3+2/5","decimalPlaces":6}` | Exact value and a decimal approximation |
| `solve` | `{"expression":"x+y=3\nx-y=1","variables":"x,y"}` | Solutions using the specified variables |
| `prepare_graph` | `{"expressions":["y=a*x","a=2"]}` | Graph JSON accepted by the app's graph import |

For matrix computations use `calculate` with `category: "matrix"` and an operation such as `det`. For a matrix equation use `category: "equations"`, `operation: "equation_matrix"` and pass the equation, unknown and matrix entries in the `matrixEquation` JSON string. Exact values are preserved. `decimalPlaces` controls approximations and accepts an integer from 0 through 50.
