// Connect to the WebSocket endpoint.
const ws = new WebSocket("ws://" + window.location.host + "/ws");

ws.onopen = function() {
    console.log("Connected to WebSocket");
    ws.send("Hello from index.html!");
};

ws.onmessage = function(event) {
    console.log("Received from server:", event.data);
};

ws.onerror = function(error) {
    console.error("WebSocket error:", error);
};

ws.onclose = function() {
    console.log("WebSocket connection closed");
};