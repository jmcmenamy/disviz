# DisViz

DisViz is a visualization tool to study executions of distributed systems. It produces a time-space diagram by parsing a JSON log file:

![DisViz time space diagram](https://raw.githubusercontent.com/jmcmenamy/meng_project/main/thesis/commit_communication.png)

DisViz is built off and extends [ShiViz](https://github.com/DistributedClocks/shiviz). See their README for a description of their tool, and their [Wiki](https://github.com/DistributedClocks/shiviz/wiki) for an in depth introduction.

See section 3.3 (page 33) of my [thesis](https://github.com/jmcmenamy/meng_project/blob/main/thesis/Josiah_MEng_Thesis.pdf) for a description of DisViz, or just clone this repo and run it. The best way to learn the tool is to use it!

[GoVector](https://github.com/jmcmenamy/GoVector) is a logging library that can be used to generate DisViz-compatible JSON logs. See [this repo](https://github.com/jmcmenamy/meng_project) for a description of how to use these tools together.

### Installation

To run this project, you'll need Node.js. You can download it from the [Node.js website](https://nodejs.org/en/download/).

After that, just clone this repo and you're good to go!

### Usage

DisViz uses a Node process as a server, which parses the entire log file and communicates with the browser to show a subset of the log file at a given time.

To start the server, run `npm start` from the cloned repo.

Paste an filepath to the JSON log file you want to visualize. You can hide processes, search for text matches and communication patterns, and inspect individual log events:

![DisViz log event](https://raw.githubusercontent.com/jmcmenamy/meng_project/main/thesis/installed_snapshot.png)

### Motivation

The reason for making a fork of the original [ShiViz](https://github.com/DistributedClocks/shiviz) was to make it easier to interact with large log files, and to add flexibility when adding information to individual log statements.

DisViz was built as part of my [MEng thesis](https://github.com/jmcmenamy/meng_project), see the [thesis](https://github.com/jmcmenamy/meng_project/blob/main/thesis/Josiah_MEng_Thesis.pdf) for a thorough description of the tool. See Chapter 6 (page 58) for examples of debugging Raft bugs with this tool; section 6.3 walks through debugging a Snapshotting bug that I never found when I first took [6.5840](https://pdos.csail.mit.edu/6.824/)!

### Modifying DisViz

I have not sufficiently tested DisViz beyond the capabilities required for my [MEng project](https://github.com/jmcmenamy/meng_project/). There are many opinionated pieces of the implementation, and I'm sure there are bugs lurking around.

If you find a bug or want a feature that doesn't exist, feel free to create an [issue](https://github.com/jmcmenamy/disviz/issues) or make a [pull request](https://github.com/jmcmenamy/disviz/pulls)!

If you use DisViz in academic work, you can cite the following:

```bibtex
@misc{mcmenamy2025disviz,
  author = {Josiah McMenamy},
  title = {DisViz: Visualizing real-world distributed system logs with space time diagrams},
  year = {2025},
  howpublished = {\url{https://github.com/jmcmenamy/meng_project/blob/main/thesis/Josiah_MEng_Thesis.pdf}}
}
```