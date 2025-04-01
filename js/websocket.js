// client.js (or inline in your HTML script)
let ws;
const reconnectDelay = 3000; // Delay in milliseconds before attempting reconnection

// A simple counter to generate unique request IDs.
let requestIdCounter = 0;
function generateRequestId() {
    return ++requestIdCounter;
}

// An object to store pending requests, keyed by request ID.
const pendingRequests = {};

function connect() {
  ws = new WebSocket("ws://" + window.location.host + "/ws");

  ws.onopen = function() {
    console.log("Connected to WebSocket");
  };

  ws.onmessage = function(event) {
    console.log("Got message on client", event);
    try {
        const message = JSON.parse(event.data);
        // If the message has an id and matches a pending request, resolve its Promise.
        if (message.id && pendingRequests[message.id]) {
          console.log("Message matched existing promise:", message)
          pendingRequests[message.id].resolve(message);
          delete pendingRequests[message.id];
        } else {
          console.log("Received message:", message);
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
  };

  ws.onerror = function(error) {
    console.error("WebSocket error:", error);
  };

  ws.onclose = function() {
    console.log(`WebSocket connection closed. Reconnecting in ${reconnectDelay / 1000} seconds...`);
    setTimeout(connect, reconnectDelay);
  };
}

// Initiate the first connection
connect();
