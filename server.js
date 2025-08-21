import { spawn } from "child_process";
import WebSocket, { WebSocketServer } from "ws";

console.log("Starting WebSocket server on port 30121...");

const wss = new WebSocketServer({ port: 30121 });
let fxServer = null;
let connectedClients = new Set();

// Start FiveM server
function startFiveM() {
    console.log("Starting FiveM server...");
    
    const args = [
        "+set", "citizen_dir", "/opt/cfx-server/citizen/",
        ...process.argv.slice(2) // Pass through any additional arguments
    ];
    
    fxServer = spawn("/opt/cfx-server/ld-musl-x86_64.so.1", [
        "--library-path", "/usr/lib/v8/:/lib/:/usr/lib/",
        "--",
        "/opt/cfx-server/FXServer",
        ...args
    ], {
        cwd: "/config",
        stdio: ['pipe', 'pipe', 'pipe']
    });

    fxServer.stdout.on("data", data => {
        const message = data.toString();
        console.log(message);
        
        // Broadcast to all connected WebSocket clients
        connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "stdout",
                    data: message
                }));
            }
        });
    });

    fxServer.stderr.on("data", data => {
        const message = data.toString();
        console.error(message);
        
        // Broadcast to all connected WebSocket clients
        connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "stderr",
                    data: message
                }));
            }
        });
    });

    fxServer.on("close", (code) => {
        console.log(`FiveM server exited with code ${code}`);
        // Notify all clients that server has stopped
        connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "server_exit",
                    code: code
                }));
            }
        });
    });

    fxServer.on("error", (error) => {
        console.error("FiveM server error:", error);
    });
}

wss.on("connection", ws => {
    console.log("Web client connected");
    connectedClients.add(ws);

    // Send initial connection message
    ws.send(JSON.stringify({
        type: "connection",
        message: "Connected to FiveM server WebSocket"
    }));

    ws.on("message", msg => {
        try {
            const data = JSON.parse(msg);
            
            if (data.type === "command" && fxServer && fxServer.stdin) {
                // Send command to FiveM server
                fxServer.stdin.write(data.command + "\n");
                console.log("Command sent to FiveM:", data.command);
            }
        } catch (error) {
            // Fallback for plain text messages
            if (fxServer && fxServer.stdin) {
                fxServer.stdin.write(msg + "\n");
            }
        }
    });

    ws.on("close", () => {
        console.log("Web client disconnected");
        connectedClients.delete(ws);
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        connectedClients.delete(ws);
    });
});

wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    wss.close();
    if (fxServer) {
        fxServer.kill('SIGTERM');
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log("Received SIGINT, shutting down gracefully...");
    wss.close();
    if (fxServer) {
        fxServer.kill('SIGINT');
    }
    process.exit(0);
});

console.log("WebSocket server started on port 30121");

// Start the FiveM server
startFiveM();
