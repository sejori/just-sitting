import nodeHttp from "node:http";
import fs from "node:fs";
import express from "express";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";

import { sitterOptions, questions } from "./lib/data.js";


const app = express();
const http = nodeHttp.Server(app);
const io = new Server(http, {
  cors: {
    origin: [
      "http://localhost:3333",
      "http://127.0.0.1:3333",
      "https://just-sitting.io" // prod
    ],
    methods: ["GET", "POST"],
  },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// SQLITE3 DB SET-UP
//
// init sqlite db for anon session analytics and feedback responses
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const db = new sqlite3.Database(dbFile);

// if ./.data/sqlite.db does not exist, create it, otherwise print record count in tables to console
db.serialize(() => {
  if (!exists) {
    // CREATE SESSION TABLE (for session analytics)
    db.run(
      "CREATE TABLE Sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, duration TEXT, start TEXT, end TEXT, complete TEXT, interactions TEXT, session_id TEXT, referer TEXT, user_agent TEXT, accept_language TEXT)"
    );
    console.log("New table: Sessions created!");
    // CREATE RESPONSES TABLE (for user feedback)
    db.run(
      "CREATE TABLE Responses (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, session_id TEXT)"
    );
    console.log("New table: Responses created!");
  } else {
    console.log('Database "Responses" ready to go!');
    console.log('Database "Sessions" ready to go!');
    db.each("SELECT MAX(id) from Sessions", (err, row) =>
      console.log(row.id ? `Sessions: ${row.id}` : err)
    );
    db.each("SELECT MAX(id) from Responses", (err, row) =>
      console.log(row.id ? `Responses: ${row.id}` : err)
    );
  }
});

// CLIENT POST ENDPOINTS
//
//
// endpoint to add response to the database
app.post("/postResponse", (request, response) => {
  console.log(`add to responses ${JSON.stringify(request.body)}`);

  const cleansedResponse = JSON.parse(
    cleanseString(JSON.stringify(request.body))
  );
  db.run(
    `INSERT INTO Responses (data, session_id) VALUES (?, ?)`,
    Object.values(cleansedResponse),
    (error) => {
      if (error) {
        console.log(error);
        response.send({ message: "error!" });
      } else {
        response.send({ message: "success" });
      }
    }
  );
});

// CLIENT GET ENDPOINTS
//
app.get("/sessions", async (req, res) => {
  db.all("SELECT * from Sessions", (err, rows) => {
    if (err) res.send(err);
    res.json(rows);
  });
});
app.get("/responses", async (req, res) => {
  db.all("SELECT * from Responses", (err, rows) => {
    if (err) res.send(err);
    res.json(rows);
  });
});

// CSS OUTPUTS
app.get("/css/breathing.css", (req, res) => {
  res.sendFile(new URL("./css/breathing.css", import.meta.url).pathname);
});
app.get("/css/question.css", (req, res) => {
  res.sendFile(new URL("./css/question.css", import.meta.url).pathname);
});
app.get("/css/meditate.css", (req, res) => {
  res.sendFile(new URL("./css/meditate.css", import.meta.url).pathname);
});
app.get("/css/business.css", (req, res) => {
  res.sendFile(new URL("./css/business.css", import.meta.url).pathname);
});
app.get("/css/atcb.min.css", (req, res) => {
  res.sendFile(new URL("./css/atcb.min.css", import.meta.url).pathname);
});

// JS OUTPUTS
app.get("/js/nosleep.min.js", (req, res) => {
  res.sendFile(new URL("./js/nosleep.min.js", import.meta.url).pathname);
});
app.get("/js/atcb.min.js", (req, res) => {
  res.sendFile(new URL("./js/atcb.min.js", import.meta.url).pathname);
});

// HTML OUTPUTS
app.get("/business", (req, res) => {
  res.sendFile(new URL("./html/business.html", import.meta.url).pathname);
});
// default to meditate html file
app.get("*", (req, res) => {
  res.sendFile(new URL("./html/meditate.html", import.meta.url).pathname);
});

// INTERNAL SERVER QUESTION LOGIC
let i = 0;
const interval = setInterval(() => {
  console.log("question ", i);
  console.log(questions[i]);
  io.emit("question update", questions[i]);
  if (i >= questions.length - 1) i = 0;
  else i++;
}, 120000);

// WEBSOCKET CONNECTION HANDLING
const sitters = [];
io.on("connection", (socket) => {
  console.log("a user connected");

  // create initial session record for analytics
  const socketParams = new URLSearchParams(socket.request.url);
  const startDate = Date.now();
  const duration = socketParams.get("/socket.io/?duration");

  db.run(
    `INSERT INTO Sessions (duration, start, session_id, referer, user_agent, accept_language) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      duration,
      startDate.toString(),
      socket.id,
      socket.request.headers["referer"],
      socket.request.headers["user-agent"],
      socket.request.headers["accept-language"],
    ],
    (error) => error && console.log(error)
  );

  // this logic is funky but it's so there are never duplicate sitters
  let sitter = "-";
  if (sitters.length < sitterOptions.length) {
    sitter =
      sitterOptions[Math.round(Math.random() * sitterOptions.length - 1)];
    while (sitters.includes(sitter)) {
      sitter =
        sitterOptions[Math.round(Math.random() * sitterOptions.length - 1)];
    }
  }
  // client only displays up to 9 at a time anyways so just put a whatever character if we run out of emoji options
  sitters.push(sitter);

  // send updated sitters to all clients
  io.emit("sitters", sitters);
  // send client sitter to client
  socket.emit("sitter", sitter);
  
  // INTERACTION LOGGING (oh yeah)
  const interactions = [];
  socket.on("interaction", function (event) {
    interactions.push(event)
  });

  // log session on session end
  socket.on("disconnect", function (sitter) {
    console.log("user disconnected");
    sitters.splice(sitters.indexOf(sitter), 1);
    io.emit("sitters", sitters);

    // update session record
    const endDate = Date.now();
    const complete =
      duration !== "dev"
        ? endDate - startDate > Number(duration) * 60000
        : false;

    console.log(complete);

    db.run(
      `UPDATE Sessions SET end = ?, complete = ?, interactions = ? WHERE session_id = ?`,
      [endDate.toString(), complete, JSON.stringify(interactions), socket.id],
      (error) => error && console.log(error)
    );
  });
});

// helper function that prevents html/css/script malice
const cleanseString = function (string) {
  return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

http.listen(process.env.PORT || 3333, () =>
  console.log(`Example app listening on port ${process.env.PORT || 3333}!`)
);
