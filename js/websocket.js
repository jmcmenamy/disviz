// client.js (or inline in your HTML script)
let ws;
const reconnectDelay = 3000; // Delay in milliseconds before attempting reconnection
const requestTimeout = 10000; // Delay in milliseconds before request times out and another is attempted

// A simple counter to generate unique request IDs.
function makeCounter() {
  let counter = 0;
  return () => ++counter;
}
let requestIdCounter = 0;
let generateRequestId = makeCounter();

// An object to store pending requests, keyed by request ID.
const pendingRequests = {};

function connect() {
  ws = new WebSocket("ws://" + window.location.host + "/ws");

  ws.onopen = function() {
    console.log("Connected to WebSocket");
  };

  ws.onmessage = function(event) {
    console.log("Got message on client");
    try {
        const message = JSON.parse(event.data);
        // If the message has an id and matches a pending request, resolve its Promise.
        if (message.id && pendingRequests[message.id]) {
          if (message.error !== undefined) {
            pendingRequests[message.id].reject(message.error);
          } else {
            pendingRequests[message.id].resolve(message);
          }
          delete pendingRequests[message.id];
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

  ws.sendWithRetry = function (message) {
    if (ws.readyState !== WebSocket.OPEN) {
      return new Promise(resolve => setTimeout(() => resolve(ws.sendWithRetry(message)), reconnectDelay));
    }
    let { promise, resolve, reject } = Promise.withResolvers();
    // display error to user if any occurs
    promise.catch((reason) => {
      const exception = new Exception(reason, true);
      Shiviz.getInstance().handleException(exception);
    });
    const requestId = generateRequestId();
    message.id = requestId;
    // Save the resolver so we can call it when the response comes back.
    pendingRequests[requestId] = { resolve, reject };
    setTimeout(() => {
        if (pendingRequests[message.id]) {
            pendingRequests[message.id].reject(`Response not received from server within ${requestTimeout} seconds, retrying`);
            delete pendingRequests[message.id];
            resolve(ws.sendWithRetry(message));
        }
    }, requestTimeout);
    console.log("Sending request", message.type);
    ws.send(JSON.stringify(message));
    return promise;
  }
}

// Initiate the first connection
connect();
