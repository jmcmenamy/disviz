// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs').promises;

const app = express();

// Serve static files from the 'public' directory
app.use(express.static(__dirname));

const server = http.createServer(app);

// Create a WebSocket server on the path '/ws'
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Client connected');
//   /Users/josiahmcmenamy/transferred_files/meng_project/etcd/tests/integration/clientv3/lease/20250331_214656/TestLeasingGetChecksForExpiration_0/combined_logs.log
  ws.on('message', async (event) => {
    console.log("Got message")
    try {
        const message = JSON.parse(event);
        switch (message.type) {
            case "filePathRequest":
                console.log("Got filePathRequest", message)
                ws.send(JSON.stringify({
                  id: message.id,
                  logs: await newFile(message.filePath, 0, message.numBytes)
                }), (err) => {
                  if (err === null) {
                    return
                  }
                  console.log("Got err when sending response: ", err)
                })
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

/**
 * Reads a portion of a file between given byte offsets,
 * expanding the range until complete lines (i.e. until newline characters)
 * are found on both sides.
 *
 * @param {string} filename - The file name (in the current directory) to read.
 * @param {number} startOffset - The desired starting byte offset.
 * @param {number} endOffset - The desired ending byte offset.
 * @returns {Promise<string>} - Resolves to the file data as a UTF-8 string containing complete lines.
 */
async function newFile(filename, startOffset, endOffset) {
  // Open the file for reading.
  const filehandle = await fs.open(filename, 'r');
  const stats = await filehandle.stat();
  const fileSize = stats.size;

  // --- Adjust the start offset backwards to a newline ---
  let adjustedStart = startOffset;
  if (startOffset > 0) {
    const chunkSize = 1024;
    let pos = startOffset;
    let found = false;
    // Loop until we either reach the beginning of the file or find a newline.
    while (pos > 0 && !found) {
      const chunkStart = Math.max(0, pos - chunkSize);
      const length = pos - chunkStart;
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await filehandle.read(buffer, 0, length, chunkStart);
      const chunkStr = buffer.toString('utf8', 0, bytesRead);
      const newlineIndex = chunkStr.lastIndexOf('\n');
      if (newlineIndex !== -1) {
        // Set adjustedStart to the character immediately after the newline.
        adjustedStart = chunkStart + newlineIndex + 1;
        found = true;
      } else {
        // No newline found in this chunk; move further back.
        pos = chunkStart;
      }
    }
    if (!found) {
      // If no newline was found at all, start at the beginning.
      adjustedStart = 0;
    }
  } else {
    adjustedStart = 0
  }

  // --- Adjust the end offset forward to a newline ---
  let adjustedEnd = endOffset;
  if (endOffset < fileSize) {
    const chunkSize = 1024;
    let pos = endOffset;
    let found = false;
    // Loop until we either reach the end of the file or find a newline.
    while (pos < fileSize && !found) {
      const length = Math.min(chunkSize, fileSize - pos);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await filehandle.read(buffer, 0, length, pos);
      const chunkStr = buffer.toString('utf8', 0, bytesRead);
      const newlineIndex = chunkStr.indexOf('\n');
      if (newlineIndex !== -1) {
        // Include the newline by adding 1.
        adjustedEnd = pos + newlineIndex + 1;
        found = true;
      } else {
        // No newline found in this chunk; move further forward.
        pos += length;
      }
    }
    if (!found) {
      // If no newline is found, go to the end of the file.
      adjustedEnd = fileSize;
    }
  } else {
    adjustedEnd = fileSize;
  }

  // --- Read and return the data between the adjusted offsets ---
  const readLength = adjustedEnd - adjustedStart;
  const finalBuffer = Buffer.alloc(readLength);
  await filehandle.read(finalBuffer, 0, readLength, adjustedStart);
  await filehandle.close();
  console.log("Returninig");
  return finalBuffer.toString('utf8');
}


// Start the server on port 8080
server.listen(8080, () => {
  console.log('Server is listening on port 8080');
});
