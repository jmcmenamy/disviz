// server.js
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import express from 'express';
import * as http from 'http'
import { WebSocketServer } from 'ws';
import * as vm from 'vm'
import * as path from 'path'
import fs from 'fs';
import assert from 'assert';
// const express = require('express');
// const http = require('http');
// const WebSocket = require('ws');
// const vm = require('vm');
// const path = require('path');
// const fs = require('fs').promises;

// Create a Proxy using a no-op function and our handler.
// Imported code uses these objects for front end things, so we make them chainable no-ops
['$', 'd3', 'window', 'document'].reduce(
  (proxy, prop) => globalThis[prop] = proxy, new Proxy(() => {}, {
  // Intercepts property access, e.g. $().testing
  get(target, prop, receiver) {
    return receiver;
  },
  // Intercepts function calls, e.g. $()
  apply() {
    return $;
  }
}));
globalThis.searchBarInput = ""

// console.log($().testing().hello.testing())


function loadGlobalScript(filename) {
  const filePath = path.join(__dirname, filename);
  const code = fs.readFileSync(filePath, {encoding: 'utf8'} );
  // Run the code in the current context, so any variables declared at the top level
  // (without using module exports) will be added to the global object.
  vm.runInThisContext(code, { filename: filePath });
}

// load all js_server files in global context (for ease of implementation)
[
  "js_server/shiviz.js", "js_server/dev.js", "js_server/searchBar.js", "js_server/clusterer.js",
  "js_server/graph/graphEvent.js", "js_server/graph/abstractGraph.js", "js_server/graph/abstractNode.js", "js_server/graph/graphTraversal.js", "js_server/graph/dfsGraphTraversal.js",
  "js_server/builder/builderGraph.js", "js_server/builder/builderNode.js", "js_server/builder/graphBuilder.js", "js_server/builder/graphBuilderHost.js", "js_server/builder/graphBuilderNode.js",
  "js_server/logEventMatcher/lemAST.js", "js_server/logEventMatcher/lemInterpreter.js", "js_server/logEventMatcher/lemParser.js", "js_server/logEventMatcher/lemToken.js", "js_server/logEventMatcher/lemTokenizer.js", "js_server/logEventMatcher/logEventMatcher.js",
  "js_server/model/logEvent.js", "js_server/model/modelGraph.js", "js_server/model/modelNode.js", "js_server/model/parser.js", "js_server/model/vectorTimestamp.js", "js_server/model/vectorTimestampSerializer.js",
  "js_server/motifFinder/motif.js", "js_server/motifFinder/motifFinder.js", "js_server/motifFinder/motifDrawer.js", "js_server/motifFinder/broadcastGatherFinder.js", "js_server/motifFinder/customMotifFinder.js", "js_server/motifFinder/motifGroup.js", "js_server/motifFinder/motifNavigator.js", "js_server/motifFinder/requestResponseFinder.js", "js_server/motifFinder/textQueryMotifFinder.js",
  "js_server/transform/transformation.js", "js_server/transform/collapseSequentialNodesTransformation.js", "js_server/transform/hideHostTransformation.js", "js_server/transform/highlightHostTransformation.js", "js_server/transform/highlightMotifTransformation.js", "js_server/transform/showDiffTransformation.js", "js_server/transform/transformer.js",
  "js_server/util/exception.js", "js_server/util/regexp.js", "js_server/util/util.js",
  "js_server/visualization/controller.js", "js_server/visualization/global.js", "js_server/visualization/hostPermutation.js", "js_server/visualization/layout.js", "js_server/visualization/view.js", "js_server/visualization/visualEdge.js", "js_server/visualization/visualGraph.js", "js_server/visualization/visualNode.js", "js_server/visualization/abbreviation.js",
].forEach(path => loadGlobalScript(path));
// console.log(ModelGraph, "testing")

// global singleton shiviz instance
Shiviz.instance = new Shiviz();

const app = express();

// Serve static files from the 'public' directory
app.use(express.static(__dirname));

// defines the file that will be continuously read from
let currentFilename = undefined;
let filehandle = undefined;
let delimiterString = undefined;
let regexpString = undefined;
let sortType = undefined;
let descending = undefined;
let stats = undefined;

const server = http.createServer(app);

// Create a WebSocket server on the path '/ws'
const wss = new WebSocketServer({ server, path: '/ws'});

wss.on('connection', (ws) => {
  console.log('Client connected');
//   /Users/josiahmcmenamy/transferred_files/meng_project/etcd/tests/integration/clientv3/lease/20250331_214656/TestLeasingGetChecksForExpiration_0/combined_logs.log
  ws.on('message', async (event) => {
    console.log("Got message")
    try {
        const message = JSON.parse(event);
        console.log("Message is ", message)
        switch (message.type) {
            case "filePathRequest":
              return await handleFilePathRequest(message);
            case "slideWindowRequest":
              return await handleSlideWindowRequest(message);
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


  async function handleFilePathRequest(message) {
    console.log("Got filePathRequest", message);
    await setNewFile(message);
    // TODO: Send the filesize so they know ending offset,
    // TODO: Send the new starting and ending offsets
    const { bytesRead, logs } = await slideWindow(0, message.numBytes);
    console.log("For filesize returning ", stats.size)
    ws.send(JSON.stringify({
      id: message.id,
      logs: logs,
      filePath: currentFilename,
      fileSize: stats.size,
      startOffset: 0,
      endOffset: bytesRead,
    }), (err) => {
      if (err === null) {
        return
      }
      console.log("Got err when sending response: ", err);
    })
  }
  
  async function handleSlideWindowRequest(message) {
    console.log("Got slideWindowRequest", message);
    assert(message.filePath === currentFilename, `Expected ${currentFilename}, got ${message.filePath}`);
  
    const startOffset = Math.max(0, message.startOffset);
    const endOffset = Math.min(stats.size, message.endOffset);
    console.log("Intermediate offsets", startOffset, endOffset, stats, message.endOffset);
    // bound the offsets we look for
    const { bytesRead, logs } = await slideWindow(
      startOffset,
      endOffset
    )
    ws.send(JSON.stringify({
      id: message.id,
      logs: logs,
      startOffset: startOffset,
      endOffset: startOffset + bytesRead
    }), (err) => {
      if (err === null) {
        return
      }
      console.log("Got err when sending response: ", err);
    });
    console.log("Send slide window response with offsets", startOffset, startOffset+ bytesRead);
  }
});

async function setNewFile(message) {

  // first we'll set all the global variable
  console.log("desc is ", message.descending.type, message.descending, typeof message.descending)
  currentFilename = message.filePath;
  regexpString = message.regexpString;
  delimiterString = message.delimiterString;
  sortType = message.sortType;
  descending = message.descending;
  if (filehandle !== undefined) {
    await filehandle.close();
  }
  // need to sort it and write it back so we only ever send valid subsets of the log events

  // TODO update delimiterString and regexpString if needed

  const fileText = await fs.promises.readFile(currentFilename, { encoding: 'utf-8'});

  // parse the logs like its done on the front end
  Shiviz.getInstance().visualize(fileText, regexpString, delimiterString, sortType, descending);

  const hostPermutation = SearchBar.getInstance().getGlobal().getHostPermutation();

  assert(hostPermutation.getGraphs().length >= 1, 'Found no graphs');

  let sortedFileText = "";
  for (const graph of hostPermutation.getGraphs()) {
    if (sortedFileText !== "") {
      sortedFileText += delimiterString;
    }
    const hosts = graph.getHosts();
    assert(hosts.length >= 1);
    // must call getNext first because first node is dummy node, see js_server/abstractGraph.js
    let node = graph.getHead(hosts[0]).getNext();
    console.log(node.logEvents.length, "log events lenght for head node")
    for (const node of graph.getNodesTopologicallySorted()) {
      for (const logEvent of node.getLogEvents()) {
        sortedFileText += `${logEvent.getLogLine()}\n`
      }
    }
  }


  // TODO: Now check if this file exists before doing all this stuff
  currentFilename = getSortedFilename(currentFilename)
  await fs.promises.writeFile(currentFilename, `${regexpString}\n\n${sortedFileText}`, { encoding: 'utf8'});

  filehandle = await fs.promises.open(currentFilename, 'r');
  stats = await filehandle.stat();

  // console.log(SearchBar.getInstance().getGlobal().getHostPermutation());
}

function getSortedFilename(filename) {
  // Insert '_sorted' before the last period if it exists
  let lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    lastDotIndex = filename.length
  }
  return filename.slice(0, lastDotIndex) + '_sorted' + filename.slice(lastDotIndex);
}

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
async function slideWindow(startOffset, endOffset) {
  // Open the file for reading.
  // const filehandle = await fs.open(filename, 'r');
  // const stats = await filehandle.stat();
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
  const {bytesRead } = await filehandle.read(finalBuffer, 0, readLength, adjustedStart);
  console.log("Returninig");
  return { bytesRead: bytesRead, logs: finalBuffer.toString('utf8')};
}


// Start the server on port 8080
server.listen(8080, () => {
  console.log('Server is listening on port 8080');
});
